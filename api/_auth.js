export async function requireKey(req){
  const key = req.headers['x-api-key'] || req.query.key;
  if (!key) throw { status:401, message:'Missing API key. Free users can only use Embeds.' };
  
  if (key === 'EMBED_DEMO') return { key, plan:'embed' };

  const snap = await db.collection('apiKeys').doc(key).get();
  if (!snap.exists) throw { status:401, message:'Invalid API key' };
  
  const data = snap.data();
  
  // 🚨 NAYA LOGIC: Agar key active nahi hai (yaani pending hai)
  if (data.status !== 'active') {
    throw { status: 403, message: 'API key is pending. Please complete the payment and wait for admin approval.' };
  }

  const today = new Date().toISOString().slice(0,10);
  const usageRef = db.collection('apiKeys').doc(key).collection('usage').doc(today);
  const usage = await usageRef.get();
  const used = usage.exists ? (usage.data().count || 0) : 0;
  
  let limit = data.dailyLimit || 10000; 
  
  if (used >= limit) throw { status:429, message:`Daily limit ${limit} reached` };
  
  await usageRef.set({ count: FieldValue.increment(1) }, { merge:true });
  return { key, plan:data.plan, used:used+1, limit };
}
