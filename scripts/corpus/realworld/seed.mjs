/**
 * A small, deterministic Conduit dataset (#442): four authors, twelve articles,
 * eleven tags, follows, favorites and comments. Avatars are inline SVG so no
 * screenshot depends on an external host.
 *
 *   node scripts/corpus/realworld/seed.mjs http://localhost:8080/api
 */

const AVATAR = (fill) =>
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' fill='${encodeURIComponent(fill)}'/%3E%3C/svg%3E`;

const AUTHORS = [
  ['ada-lovelace', 'Analytical engines and poetry.', '#7c3aed'],
  ['grace', 'Compilers, COBOL, nanoseconds.', '#0891b2'],
  ['linus', 'Kernels and version control.', '#ca8a04'],
  ['margaret', 'Flight software that landed.', '#dc2626'],
];

const ARTICLES = [
  ['ada-lovelace', 'Notes on the Analytical Engine', 'What a general-purpose machine could do', 'The engine weaves algebraic patterns just as the Jacquard loom weaves flowers.', ['history', 'computing']],
  ['ada-lovelace', 'Poetical science', 'Imagination as a discipline', 'Imagination is the discovering faculty, pre-eminently.', ['essays']],
  ['grace', 'Why compilers matter', 'Humans should write in human terms', 'It is much easier for most people to write an English statement than to use symbols.', ['compilers', 'computing']],
  ['grace', 'A nanosecond, held in the hand', 'Eleven point eight inches of wire', 'Every programmer should know how far light travels in a nanosecond.', ['performance', 'history']],
  ['grace', 'The most dangerous phrase', 'We have always done it this way', 'Ships in harbor are safe, but that is not what ships are built for.', ['essays', 'teams']],
  ['linus', 'Release early, release often', 'On merging patches at scale', 'Talk is cheap. Show me the code.', ['open-source', 'teams']],
  ['linus', 'Good taste in code', 'Removing the special case', 'Sometimes you can see a problem in a different way and rewrite it so the special case goes away.', ['craft']],
  ['linus', 'Why git is fast', 'Content-addressed everything', 'A tree is a list of names pointing at blobs and other trees.', ['tools', 'performance']],
  ['margaret', 'Priority displays', 'What the computer did during the landing', 'The software recognised it was being asked to do more than it should and shed the lower priority work.', ['history', 'reliability']],
  ['margaret', 'Software engineering, the name', 'Giving the discipline legitimacy', 'I fought to bring the software legitimacy so that it would be given its due respect.', ['essays', 'reliability']],
  ['margaret', 'Errors are a design input', 'Asynchronous executive and restart', 'Design for the error you have not imagined yet.', ['reliability', 'craft']],
  ['ada-lovelace', 'Bernoulli numbers by machine', 'Note G, step by step', 'Here follows a table of the operations the engine would perform.', ['computing', 'math']],
];

const FOLLOWS = [
  ['ada-lovelace', 'grace'],
  ['ada-lovelace', 'margaret'],
  ['grace', 'ada-lovelace'],
  ['linus', 'grace'],
  ['margaret', 'linus'],
];

export async function seed(api) {
  const call = async (method, path, body, token) => {
    const res = await fetch(api + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Token ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  };
  const tokens = {};
  for (const [username, bio, color] of AUTHORS) {
    const { user } = await call('POST', '/users', { user: { username, email: `${username}@conduit.test`, password: 'password123' } });
    await call('PUT', '/user', { user: { bio, image: AVATAR(color) } }, user.token);
    tokens[username] = user.token;
  }
  const slugs = [];
  for (const [author, title, description, body, tagList] of ARTICLES) {
    const { article } = await call('POST', '/articles', { article: { title, description, body, tagList } }, tokens[author]);
    slugs.push([author, article.slug]);
  }
  for (const [follower, followee] of FOLLOWS) await call('POST', `/profiles/${followee}/follow`, {}, tokens[follower]);
  const names = Object.keys(tokens);
  for (const [i, [author, slug]] of slugs.entries()) {
    for (const [j, fan] of names.entries()) {
      if (fan !== author && (i + j) % 3 === 0) await call('POST', `/articles/${slug}/favorite`, {}, tokens[fan]);
      if (fan !== author && (i + j) % 4 === 1) await call('POST', `/articles/${slug}/comments`, { comment: { body: `${fan} on “${slug}”: well put.` } }, tokens[fan]);
    }
  }
  return { authors: names.length, articles: slugs.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed(process.argv[2] ?? 'http://localhost:8080/api').then((r) => process.stdout.write(`${JSON.stringify(r)}\n`));
}
