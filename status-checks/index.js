const cp = require('child_process');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const checks = require('./checks');

const [owner, repo] = process.env.GH_REPO.split('/');

function getCurrentCommitSha() {
  return cp
    .execSync(`git rev-parse HEAD`)
    .toString()
    .trim();
}

// The SHA provied by GITHUB_SHA is the merge (PR) commit.
// We need to get the current commit sha ourself.
const sha = getCurrentCommitSha();

async function setStatus(context, state, description) {
  return fetch(`https://api.github.com/repos/${owner}/${repo}/statuses/${sha}`, {
    method: 'POST',
    body: JSON.stringify({
      state,
      description,
      context,
    }),
    headers: {
      Authorization: `Bearer ${process.env.GH_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
}

(async () => {
  console.log(`Starting status checks for commit ${sha}`);

  // Run in parallel
  await Promise.all(
    checks.map(async check => {
      const { name, callback } = check;

      await setStatus(name, 'pending', 'Running check..');

      try {
        const response = await callback();
        await setStatus(name, 'success', response);
      } catch (err) {
        const message = err ? err.message : 'Something went wrong';
        await setStatus(name, 'failure', message);
      }
    }),
  ).catch(error => {
    console.error(error.message)
  });

  console.log('Finished status checks');
})();
