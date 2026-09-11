const express = require('express');
const bcrypt = require('bcrypt');
const { validateBody } = require('../validation/validate');
const { RegisterBodySchema, LoginBodySchema } = require('../validation/schemas');

function createAuthRouter({ userRepository, authenticateUser }) {
  const router = express.Router();

  router.post('/auth/register', validateBody(RegisterBodySchema), async (req, res) => {
    const { email, password, role } = req.body;

    const existing = await userRepository.findByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // NOTE: Password is never logged. The hash is stored; the raw value is
    // discarded immediately after hashing. (PII/secrets log audit — commit 5)
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await userRepository.createUser({ email, passwordHash, role });
    res.status(201).json(user);
  });

  router.post('/auth/login', validateBody(LoginBodySchema), async (req, res) => {
    const { email, password } = req.body;
    try {
      const result = await authenticateUser.login({ email, password });
      res.json(result);
    } catch (err) {
      // Generic 401 — do not reveal whether email exists or password was wrong
      // (OWASP A07 — Identification and Authentication Failures)
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });

  return router;
}

module.exports = createAuthRouter;