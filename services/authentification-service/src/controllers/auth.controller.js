const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mailer = require('../utils/mailer');
const { getPool } = require('../db');


exports.health = async (req, res) => {
    try {
        res.json({ status: 'OK', service: 'books-service', timestamp: new Date().toISOString() });
    } catch {
        res.status(500).send();
    }
};

exports.login = async (req, res) => {
    try {
        const [rows] = await getPool().query(
            'SELECT id,password FROM users WHERE email = ?',
            [req.body.username]
        );
        const user = rows[0];
      
        if (!user) return res.status(400).json({ message: "Utilisateur non trouvé" });

        if (await bcrypt.compare(req.body.password, user.password)) {
            const payload = { username: req.body.email, action: 'login' };
            
            const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, { expiresIn: process.env.ACCESS_TOKEN_EXPIRY });
            const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, { expiresIn: process.env.REFRESH_TOKEN_EXPIRY });
            
            res.json({ accessToken, refreshToken });
        } else {
            res.status(401).json({ message: "Login ou Mot de passe incorrect(s)" });
        }        
        //return genericResponse();

    } catch (err) {
        console.error('[forgotPassword]', err);
        return res.status(500).json({ message: "Erreur serveur." });
    }
};

exports.token = async (req, res) => {
    const { token } = req.body;
    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        const accessToken = jwt.sign({ username: user.username }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: process.env.ACCESS_TOKEN_EXPIRY });
        res.json({ accessToken });
    });
};

exports.logout = async (req, res) => {
    res.sendStatus(204);
};


// ================================================
// POST /auth/forgot-password
// Body : { email }
// Génère un token de reset et simule l'envoi email
// ================================================
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: "L'adresse email est requise." });
    }

    // Réponse générique dans tous les cas (sécurité anti-énumération)
    const genericResponse = () => res.status(200).json({
        message: "Si cet email est enregistré, un lien de réinitialisation a été envoyé."
    });

    try {
        const [rows] = await getPool().query(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (rows.length === 0) return genericResponse();

        const user = rows[0];
        // Générer un token sécurisé
        const resetToken = jwt.sign(
					{ id: user.id, email: email, action: 'init_password' },
					process.env.ACCESS_TOKEN_SECRET,
					{ expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
				);
        const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5500'}/reset-password.html?token=${resetToken}`;
        console.log(`[DEV] Lien reset pour ${email} → ${resetLink}`);
		// Envoyer l'email
		await mailer.sendWelcomeEmail(email, resetToken);

        

        return genericResponse();
    } catch (err) {
        console.error('[forgotPassword]', err);
        return res.status(500).json({ message: "Erreur serveur." });
    }
};

// ================================================
// POST /auth/reset-password
// Body : { token, password }
// ================================================
exports.resetPassword = async (req, res) => {
    const { token, password } = req.body;

    if (!token || !password) {
        return res.status(400).json({ message: "Token et nouveau mot de passe requis." });
    }

    try {
        // La méthode verify décode le token et vérifie la signature + l'expiration
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        // Récupération du user.id
        const userId = decoded.id;
        const userEmail = decoded.email;
        const action = decoded.action;

        // Sécurité supplémentaire : vérifier que c'est bien un token d'initialisation
        if (action !== 'init_password') {
            return res.status(403).json({ message: "Action non autorisée avec ce token." });
        }

        console.log(`Token valide pour l'utilisateur ID: ${userId}`);

        if (password.length < 8) {
            return res.status(400).json({ message: "Le mot de passe doit contenir au moins 8 caractères." });
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        await getPool().query(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedPassword, userId]
        );

        return res.status(200).json({ message: "Mot de passe réinitialisé avec succès." });

    } catch (err) {
        // Si le token est expiré ou si la signature est invalide
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: "Le lien a expiré (limite de 15 min dépassée)." });
        }
        console.error('[resetPassword]', err);
        return res.status(500).json({ message: "Erreur serveur." });
    }

};