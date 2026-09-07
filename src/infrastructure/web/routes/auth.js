const express = require('express');
const bcrypt = require('bcrypt');

function createAuthRouter({ userRepository, authenticateUser }) {
  const router = express.Router();

  router.post('/auth/register', async (req, res) => {
    const { email, password, role } = req.body;
    if (!email || !password || !['technician', 'supervisor'].includes(role)) {
      return res.status(400).json({ error: 'email, password, and a valid role are required' });
    }

    const existing = await userRepository.findByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await userRepository.createUser({ email, passwordHash, role });
    res.status(201).json(user);
  });

  router.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
      const result = await authenticateUser.login({ email, password });
      res.json(result);
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  });

  return router;
}

module.exports = createAuthRouter;