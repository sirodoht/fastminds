import { db } from "./db";

const fakeUsers = [
  "socrates",
  "hypatia",
  "ada",
  "tesla",
  "octavia",
  "borges",
  "curie",
  "turing",
];

const fakePosts = [
  {
    author: "socrates",
    title: "What belief have you changed your mind about recently?",
    body: "Not the loudest reversal — the most useful one.",
    score: 14,
    hoursAgo: 3,
  },
  {
    author: "hypatia",
    title: "Is a good question more valuable than a fast answer?",
    body: "I keep noticing that the shape of the question decides almost everything downstream.",
    score: 21,
    hoursAgo: 6,
  },
  {
    author: "ada",
    title: "Small systems can still have elegant architecture",
    body: "Sometimes the kindest thing you can do for a project is keep it legible before it becomes large.",
    score: 9,
    hoursAgo: 10,
  },
  {
    author: "tesla",
    title: "What idea sounded absurd until you understood it?",
    body: "",
    score: 18,
    hoursAgo: 15,
  },
  {
    author: "octavia",
    title: "The future is usually negotiated in ordinary rooms",
    body: "Which mundane choices today do you think will look consequential in ten years?",
    score: 27,
    hoursAgo: 24,
  },
  {
    author: "borges",
    title: "A library that contains every possible book is mostly noise",
    body: "Abundance without orientation is just another kind of scarcity.",
    score: 16,
    hoursAgo: 31,
  },
  {
    author: "curie",
    title: "What are you currently investigating just because it is beautiful?",
    body: "",
    score: 12,
    hoursAgo: 42,
  },
  {
    author: "turing",
    title: "When does a tool become a collaborator?",
    body: "Is it about autonomy, surprise, usefulness, or something stranger?",
    score: 24,
    hoursAgo: 54,
  },
  {
    author: "ada",
    title: "A tiny habit that improved your thinking",
    body: "Mine: writing down the exact sentence I am trying to prove before I start working.",
    score: 11,
    hoursAgo: 68,
  },
  {
    author: "hypatia",
    title: "What should every curious person learn once?",
    body: "",
    score: 19,
    hoursAgo: 80,
  },
];

const passwordHash = await Bun.password.hash("password123");
const usersByUsername = new Map<string, string>();

for (const username of fakeUsers) {
  const [user] = await db`
    INSERT INTO users (username, password_hash)
    VALUES (${username}, ${passwordHash})
    ON CONFLICT (username) DO UPDATE
      SET username = EXCLUDED.username
    RETURNING id, username
  `;

  usersByUsername.set(user.username, user.id);
}

let insertedPosts = 0;

for (const post of fakePosts) {
  const authorId = usersByUsername.get(post.author);
  if (!authorId) continue;

  const [existing] = await db`
    SELECT id
    FROM posts
    WHERE author_id = ${authorId}
      AND title = ${post.title}
    LIMIT 1
  `;

  if (existing) continue;

  await db`
    INSERT INTO posts (title, body, author_id, score, created_at)
    VALUES (
      ${post.title},
      ${post.body},
      ${authorId},
      ${post.score},
      ${new Date(Date.now() - post.hoursAgo * 60 * 60 * 1000)}
    )
  `;

  insertedPosts++;
}

console.log(`Seed complete: ${fakeUsers.length} users ready, ${insertedPosts} new posts inserted`);
console.log("Seed login password for fake users: password123");
process.exit(0);
