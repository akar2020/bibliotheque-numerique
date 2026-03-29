const { getPool } = require('../db');
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
  const { name, email, type, phone, student_id } = req.body;
  if (!name || !email) {
    return res.status(400).json({ success: false, message: 'Nom et email sont requis.' });
  }
  const validTypes = ['Etudiant', 'Professeur', 'Personnel administratif'];
  if (type && !validTypes.includes(type)) {
    return res.status(400).json({ success: false, message: `Type invalide. Valeurs autorisées : ${validTypes.join(', ')}` });
  }
  try {
    const [result] = await getPool().query(
      'INSERT INTO users (name, email, type, phone, student_id, password) VALUES (?, ?, ?, ?, ?,?)',
      [name, email, type || 'Etudiant', phone || null, student_id || null, 'TEMP_WAITING_INIT']
    );

    // 2. Générer un Token d'Initialisation
    const initToken = jwt.sign(
        { id: result.insertId, email: email, action: 'init_password' },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
    );
    // 3. Envoyer l'email
    await mailer.sendWelcomeEmail(email, initToken);


    const [user] = await getPool().query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'Utilisateur créé avec succès.', data: user[0] });
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
