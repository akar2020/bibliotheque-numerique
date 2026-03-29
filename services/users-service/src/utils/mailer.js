const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    }
});

exports.sendWelcomeEmail = async (email, token) => {
    const url = `${process.env.URL_INIT_PWD}?token=${token}`; //${role} <strong>${role}</strong>
    
    const mailOptions = {
        from: `"Service support" <${process.env.MAIL_USER}>`,
        to: email,
        subject: `Activation de votre compte _`,
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                <h2>Bienvenue dans notre établissement !</h2>
                <p>Un compte _ a été créé pour vous.</p>
                <p>Pour des raisons de sécurité, vous devez définir votre propre mot de passe avant votre première connexion.</p>
                <div style="margin: 30px 0;">
                    <a href="${url}" 
                       style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">
                       Initialiser mon mot de passe
                    </a>
                </div>
                <p>Ce lien est valable pendant 1 heure.</p>
                <hr>
                <small>Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer cet email.</small>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email envoyé avec succès à ${email}`);
    } catch (error) {
        console.error(" Erreur d'envoi d'email :", error);
        throw error;
    }
};