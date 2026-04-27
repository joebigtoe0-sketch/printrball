// Mock data + helpers for PRINTR Powerball

const SEED_WALLETS = [
  '7xKzQ3pYj4mNvLb8aRfH2sWdGcEt1uXq9Y6Pz5JwAa',
  '9aB2nM7qR3kLpV5xJfH8tCwY1eZ4uS6dGoXi0Tr2Pm',
  'Hf3RtQ8sKmL4xNpA9gB7yWcZ2vUjE5dYi6Po1Tx0Ma',
  '4zN9wY7xCqV2kR8bMtJpL5aHfG3sDeU1iX6oP0AyTm',
  'Pq2sM5kJ8tRxN3vL7yA9bC4dE6fG1hZ0iU8oWnX2Bm',
  'Lk6Hn3xRqB9sV4mT7pY2cF8jD1gZ5wU0iA3oXeNwPa',
  'Vt8JpY4mN7sL2kRxA9bH3cZ6dG1fE5wU0iX2oQnBma',
  'Mj4Hf7sK9pL3xN8qR2yB5cT1dE6gZ0wU8iY7oVnPxa',
  'Rq9pY3xN6mL2kJ8sH7tA4bC5dF1gE0wU3iV6oXnZBa',
  'Cn5kT8pY3xR9mL2sJ4qH7tA1bV6dF0gE8wU5iZnPxa',
  'Wx2pL4mN8sK6tR3yY5aB7cD9fH1jZ0gE6wU3iVoXna',
  'Yk3nM7pR2sL5xJ8tH4qY9aB1cD6fG0iE5wU2oVnZxa',
  'Bf6Nh3sK9pL7xR2mT4yA8bC5dE1gZ0jU3iV6oWnXya',
  'Em8Lp5sN3kJ7xR2tY4aH9bC1dF6gZ0iU8oV3wXnQya',
  'Tu4Rk7sM9pL3xN2qY8aB5cH1dF6gE0jU3iV7oWnZxa',
  'Gz9Pp2sR5kL8xN3mY7aH1bC4dE6fJ0iU5oV8wXnQya',
  'Sj7Lh4sK2pN9xR3tY8aB6cD1dF0gE5iU3oV7wXnZma',
  'Ax3Mp6sL9kJ2xN5tH7qY1aB8cD4dF0gE6iU5oV3WXna',
  'Dq8Nh5sK3pL7xR2tY4aB9cH1dF6gE0iU8oV3wXnZma',
  'Fy2Lk9sN6pJ3xR5mY7aH1bC8dE0fG4iU5oV2wXnQpa',
  'Hp4Rm7sK2pL9xN3tY5aB8cD6dF1gE0iU3oV7wXnZma',
  'Iv6Mp3sL8kJ5xN7tH2qY9aB1cD4dF0gE6iU5oV3WXna',
  'Jw9Nh2sK6pL3xR8tY4aB5cD1dF7gE0iU8oV3wXnZma',
  'Ky2Lk5sN8pJ4xR9mY3aH7bC1dE0fG6iU5oV2wXnQpa',
  'Ld5Rm8sK3pL7xN2tY9aB4cD6dF1gE0iU3oV7wXnZma',
];

function pickAddr(i) { return SEED_WALLETS[i % SEED_WALLETS.length]; }
function shortAddr(a) { return `${a.slice(0,4)}…${a.slice(-4)}`; }

function fmtAmount(n, decimals = 3) {
  return n.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function fmtUSD(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}
function fmtPct(n, dp = 2) { return n.toFixed(dp) + '%'; }

// Pseudo-random but deterministic per index for reproducibility
function seededHoldings(i) {
  const seed = (i * 9301 + 49297) % 233280;
  const rnd = seed / 233280;
  // distribution: top heavy, falls off fast
  const pct = (8 / (i + 1.4) + rnd * 0.6 + 0.21);
  return Math.max(0.21, +pct.toFixed(2));
}
function seededStreak(i) {
  return [42, 28, 17, 65, 9, 11, 6, 22, 4, 13, 7, 30, 3, 14, 8, 19, 5, 24, 2, 11, 16, 6, 35, 4, 9][i % 25];
}

function buildLeaderboard(count = 18) {
  const totalSupply = 1_000_000_000;
  const rows = [];
  for (let i = 0; i < count; i++) {
    const pct = seededHoldings(i);
    const balance = Math.round((pct / 100) * totalSupply);
    const streak = seededStreak(i);
    const loyaltyBoost = Math.min(0.5, streak / 50);
    const weight = +(pct * (1 + loyaltyBoost)).toFixed(3);
    rows.push({
      addr: pickAddr(i),
      pct,
      balance,
      streak,
      weight,
      // odds computed after total
    });
  }
  const totalWeight = rows.reduce((s, r) => s + r.weight, 0);
  rows.forEach(r => { r.odds = +((r.weight / totalWeight) * 100).toFixed(2); });
  rows.sort((a, b) => b.weight - a.weight);
  return { rows, totalWeight };
}

const RECENT_WINNERS = [
  { round: 1428, ago: '4 min ago', prize: 4.231, usd: 812, addr: pickAddr(2), oddsAt: 3.2 },
  { round: 1427, ago: '19 min ago', prize: 3.872, usd: 743, addr: pickAddr(7), oddsAt: 1.4 },
  { round: 1426, ago: '34 min ago', prize: 5.104, usd: 980, addr: pickAddr(13), oddsAt: 0.9 },
  { round: 1425, ago: '49 min ago', prize: 2.998, usd: 575, addr: pickAddr(4), oddsAt: 5.7 },
];

const TXS = [
  '2RkP9zN3xQ8mL7sK4tJpY9aB6cV5dH1fG0iE3wU8oXn',
  '5sK7tJpY9aB6cV5dH1fG0iE3wU8oXnRkP9zN3xQ8mL2',
  '8mL7sK4tJpY9aB6cV5dH1fG0iE3wU8oXnRkP9zN3xQ4',
  'cV5dH1fG0iE3wU8oXnRkP9zN3xQ8mL7sK4tJpY9aB7',
];

const STATS = {
  totalPaid: 5847.231,
  totalPaidUSD: 1_122_352,
  rounds: 1428,
  biggestWin: 12.487,
  uniqueWinners: 247,
};

// Activity event templates
const EVENT_TEMPLATES = [
  { type: 'holder_joined', tone: 'green', icon: '↑',
    text: (a, p) => `<span class="addr">${shortAddr(a)}</span> became eligible — <span class="pct">${fmtPct(p)}</span> of supply` },
  { type: 'holder_dropped', tone: 'red', icon: '↓',
    text: (a) => `<span class="addr">${shortAddr(a)}</span> dropped out — sold below threshold` },
  { type: 'balance_changed', tone: 'muted', icon: '⇄',
    text: (a, p) => `<span class="addr">${shortAddr(a)}</span> rebalanced — now <span class="pct">${fmtPct(p)}</span>` },
  { type: 'fees_claimed', tone: 'gold', icon: '◆',
    text: (_, amt) => `Claimed <span class="amt">◆ ${fmtAmount(amt)} SOL</span> from $BALL fees` },
];

window.PB_DATA = {
  SEED_WALLETS, pickAddr, shortAddr, fmtAmount, fmtUSD, fmtPct,
  buildLeaderboard, RECENT_WINNERS, TXS, STATS, EVENT_TEMPLATES,
};
