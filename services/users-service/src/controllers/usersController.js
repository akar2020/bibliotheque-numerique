const { getPool } = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mailer = require('../utils/mailer');

// GET /api/users
const getAllUsers = async (req, res) => {
  try {
    const { type } = req.query;
    let query = 'SELECT * FROM users ORDER BY created_at DESC';
    let params = [];
    if (type) {
      query = 'SELECT * FROM users WHERE type = ? ORDER BY created_at DESC';
      params = [type];
    }
    const [rows] = await getPool().query(query, params);
    res.json({ success: true, data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/users/:id
const getUserById = async (req, res) => {
  try {
    const [rows] = await getPool().query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/users
const createUser = async (req, res) => {

  try {
    const { name, email, type, phone, student_id } = req.body;
// 1. Vérification si l'utilisateur existe déjà
    const [existing] = await getPool().query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(400).json({ success: false, message: 'Email déjà utilisé.' });

    // 2. SÉCURISATION : Hashage du mot de passe
    const hashedPassword = await bcrypt.hash(password || 'DIT_Default_2026', 10);

    // 3. Insertion avec le mot de passe sécurisé
    const [result] = await getPool().query(
      'INSERT INTO users (name, email, password, type, phone, student_id) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, type || 'Etudiant', phone || null, student_id || null]
    );

    // 2. Générer un Token d'Initialisation
    const initToken = jwt.sign(
        { id: result.insertId, email: email, action: 'init_password' },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
    );
    // 3. Envoyer l'email
    await mailer.sendWelcomeEmail(email, initToken);

    res.status(201).json({ success: true, message: 'Utilisateur créé avec succès.', data: { id: result.insertId, name, email } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Un utilisateur avec cet email existe déjà.' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/users/:id
const updateUser = async (req, res) => {
  const { name, email, type, phone, student_id } = req.body;
  try {
    const [existing] = await getPool().query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
    const u = existing[0];
    await getPool().query(
      'UPDATE users SET name=?, email=?, type=?, phone=?, student_id=? WHERE id=?',
      [
        name || u.name,
        email || u.email,
        type || u.type,
        phone !== undefined ? phone : u.phone,
        student_id !== undefined ? student_id : u.student_id,
        req.params.id,
      ]
    );
    const [updated] = await getPool().query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Utilisateur mis à jour.', data: updated[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/users/:id
const deleteUser = async (req, res) => {
  try {
    const [existing] = await getPool().query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
    await getPool().query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Utilisateur supprimé avec succès.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAllUsers, getUserById, createUser, updateUser, deleteUser };
