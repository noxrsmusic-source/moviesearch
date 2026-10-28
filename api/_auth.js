import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}
const db = getFirestore();

export async function requireKey(req){
  const key = req.headers['x-api-key'] || req.query.key;
  if (!key) throw { status:401, message:'Missing API key' };
  if (key === 'EMBED_DEMO') return { key, plan:'embed' }; // public embed key

  const snap = await db.collection('apiKeys').doc(key).get();
  if (!snap.exists) throw { status:401, message:'Invalid API key' };
  const data = snap.data();
  if (data.suspended) throw { status:403, message:'Key suspended' };

  const today = new Date().toISOString().slice(0,10);
  const usageRef = db.collection('apiKeys').doc(key).collection('usage').doc(today);
  const usage = await usageRef.get();
  const used = usage.exists ? (usage.data().count || 0) : 0;
  const limit = data.dailyLimit || 1000;
  if (used >= limit) throw { status:429, message:`Daily limit ${limit} reached` };
  await usageRef.set({ count: FieldValue.increment(1) }, { merge:true });
  return { key, plan:data.plan, used:used+1, limit };
}
