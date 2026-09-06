require('dotenv').config();
const createServer = require('./infrastructure/web/server');

const PORT = process.env.PORT || 3000;
const app = createServer();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});