const { onRequest }    = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getDatabase }  = require('firebase-admin/database');
const crypto           = require('crypto');

const SHOPIFY_ADMIN_TOKEN = defineSecret('SHOPIFY_ADMIN_TOKEN');
const SHOPIFY_API_SECRET  = defineSecret('SHOPIFY_API_SECRET');

const SHOP_DOMAIN         = 'gkic1e-xq.myshopify.com';
const API_VERSION         = '2025-01';
const METAFIELD_NAMESPACE = 'custom';
const METAFIELD_KEY       = 'talkroom_token';

const METAFIELDS_SET_MUTATION = `
  mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      userErrors { field message code }
    }
  }
`;

exports.shopifyOrdersCreate = onRequest(
  {
    region: 'asia-southeast1',
    secrets: [SHOPIFY_ADMIN_TOKEN, SHOPIFY_API_SECRET],
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }

    const hmacHeader = req.get('X-Shopify-Hmac-SHA256');
    if (!hmacHeader || !req.rawBody) {
      return res.status(401).send('Missing HMAC or body');
    }

    const computed = crypto
      .createHmac('sha256', SHOPIFY_API_SECRET.value())
      .update(req.rawBody)
      .digest('base64');

    const a = Buffer.from(hmacHeader, 'utf8');
    const b = Buffer.from(computed, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).send('Invalid HMAC');
    }

    let order;
    try {
      order = JSON.parse(req.rawBody.toString('utf8'));
    } catch (e) {
      return res.status(400).send('Invalid JSON');
    }
    if (!order || !order.id) {
      return res.status(400).send('Missing order id');
    }
    const orderId = String(order.id);

    const db = getDatabase();
    const tokenRef = db.ref(`rooms/${orderId}/token`);
    const existing = await tokenRef.get();

    let token;
    if (existing.exists()) {
      token = existing.val();
    } else {
      token = crypto.randomBytes(32).toString('hex');
      const buyerName = [
        order.customer && order.customer.first_name,
        order.customer && order.customer.last_name,
      ].filter(Boolean).join(' ') || 'お客様';
      const item  = (order.line_items && order.line_items[0] && order.line_items[0].title) || '';
      const price = order.total_price || '';
      const date  = order.created_at  || '';

      await db.ref(`rooms/${orderId}`).update({
        info: { buyerName, orderName: order.name, item, price, date },
        token,
      });
    }

    const url = `https://${SHOP_DOMAIN}/admin/api/${API_VERSION}/graphql.json`;
    let resp;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ADMIN_TOKEN.value(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: METAFIELDS_SET_MUTATION,
          variables: {
            metafields: [{
              ownerId:   `gid://shopify/Order/${orderId}`,
              namespace: METAFIELD_NAMESPACE,
              key:       METAFIELD_KEY,
              type:      'single_line_text_field',
              value:     token,
            }],
          },
        }),
      });
    } catch (e) {
      console.error('metafieldsSet fetch error:', e);
      return res.status(502).send('Upstream error');
    }

    if (!resp.ok) {
      const text = await resp.text();
      console.error(`metafieldsSet HTTP ${resp.status}: ${text}`);
      return res.status(502).send('Metafield write failed');
    }

    const body = await resp.json();
    const userErrors = body && body.data && body.data.metafieldsSet && body.data.metafieldsSet.userErrors;
    if (userErrors && userErrors.length) {
      console.error('metafieldsSet userErrors:', JSON.stringify(userErrors));
      return res.status(502).send('Metafield user errors');
    }

    res.status(200).send('ok');
  }
);
