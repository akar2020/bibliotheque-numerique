const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    // Format attendu : "Bearer <TOKEN>"
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: "Accès refusé. Token manquant." });
    }

    try {
        const verified = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET|| 'super_secret_pour_access_123');
        req.user = verified; // On attache les infos du user à la requête
        next(); // On autorise le passage à la route suivante
    } catch (err) {
        res.status(403).json({ error: "Token invalide ou expiré." });
    }
};