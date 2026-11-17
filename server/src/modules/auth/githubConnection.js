const crypto = require('crypto');
const { GithubConnection } = require('../../database/models');

async function saveGithubConnection(userId, values) {
  const [connection] = await GithubConnection.findOrCreate({
    where: { userId },
    defaults: { id: crypto.randomUUID(), ...values },
  });
  await connection.update(values);
  return connection;
}

module.exports = { saveGithubConnection };
