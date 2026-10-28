import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// ============================================================
// 1. FIREBASE INITIALIZATION
// ============================================================
if (!getApps().length) {
  try {
    // Vercel Environment Variable se JSON parse kar rahe hain
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    
    initializeApp({
      credential: cert(serviceAccount)
    });
  } catch (error) {
    console.error("Firebase Init Error:", error.message);
    throw new Error("Firebase Service Account JSON is invalid.");
  }
}

const db = getFirestore();

// ============================================================
// 2. API KEY & USAGE VALIDATION
// ============================================================
export async function requireKey(req) {
  // Key headers ya query params se uthayenge
  const key = req.headers['x-api-key'] || req.query.key;
  
  if (!key) {
    throw { status: 401, message: 'Missing API key. Free users can only use Embeds.' };
  }
  
  // Free Embeds ke liye bypass (agar aap embed pages ke liye use kar rahe hain)
  if (key === 'EMBED_DEMO') {
    return { key, plan: 'embed', used: 0, limit: 999999 };
  }

  // Firestore se key fetch karein
  const snap = await db.collection('apiKeys').doc(key).get();
  
  if (!snap.exists) {
    throw { status: 401, message: 'Invalid API key.' };
  }
  
  const data = snap.data();
  
  // 1. Status Check (Active hona chahiye)
  if (data.status !== 'active') {
    if (data.status === 'pending') {
      throw { status: 403, message: 'API key is pending. Please complete the payment and wait for admin approval.' };
    }
    throw { status: 403, message: 'API key is suspended or expired.' };
  }

  // 2. Expiry Check (30 Din wala logic)
  if (data.expiresAt && Date.now() > data.expiresAt) {
    // Agar date nikal gayi, toh database mein status suspend kar dein
    await db.collection('apiKeys').doc(key).update({ status: 'suspended' });
    throw { status: 403, message: 'Subscription expired! Please renew your plan.' };
  }

  // 3. Daily Rate Limit Check
  const today = new Date().toISOString().slice(0, 10); // Format: YYYY-MM-DD
  const usageRef = db.collection('apiKeys').doc(key).collection('usage').doc(today);
  const usage = await usageRef.get();
  const used = usage.exists ? (usage.data().count || 0) : 0;
  
  // Default limit (agar database mein set nahi hai toh 10,000)
  const limit = data.dailyLimit || 10000; 
  
  if (used >= limit) {
    throw { status: 429, message: `Daily limit of ${limit} requests reached. Please upgrade or wait for tomorrow.` };
  }
  
  // 4. Usage Count Badhayein (+1)
  await usageRef.set({ count: FieldValue.increment(1) }, { merge: true });
  
  return { 
    key: key, 
    plan: data.plan, 
    used: used + 1, 
    limit: limit 
  };
}
