const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class AuthenticateUser {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async login({ email, password }) {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      throw new Error('Invalid credentials');
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return { token, role: user.role, userId: user.id };
  }
}

module.exports = AuthenticateUser;