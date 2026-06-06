export function getAvatarFallback(name) {
  if (!name) return { text: '?', background: 'linear-gradient(135deg, #cbd5e1, #94a3b8)' };
  
  const text = name.trim().charAt(0).toUpperCase();
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  const background = `linear-gradient(135deg, hsl(${h}, 75%, 65%), hsl(${h}, 75%, 50%))`;
  
  return {
    text,
    background
  };
}

export default {
  getAvatarFallback
};
