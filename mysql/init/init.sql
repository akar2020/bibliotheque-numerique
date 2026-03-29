-- ==========================================================
-- BIBLIOTHÈQUE NUMÉRIQUE DIT - SCRIPT MYSQL COMPLET
-- ==========================================================

CREATE DATABASE IF NOT EXISTS biblio_dit
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE biblio_dit;

-- ==========================================================
-- TABLE BOOKS
-- ==========================================================
CREATE TABLE IF NOT EXISTS books (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    author      VARCHAR(255) NOT NULL,
    isbn        VARCHAR(30)  UNIQUE NOT NULL,
    description TEXT,
    category    VARCHAR(100),
    quantity    INT DEFAULT 1,
    available   INT DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ==========================================================
-- TABLE USERS
-- ==========================================================
CREATE TABLE IF NOT EXISTS users (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    email       VARCHAR(255) UNIQUE NOT NULL,
    type        ENUM('Etudiant','Professeur','Personnel administratif') DEFAULT 'Etudiant',
    phone       VARCHAR(20),
    student_id  VARCHAR(50),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ==========================================================
-- TABLE LOANS (avec clés étrangères)
-- ==========================================================
CREATE TABLE IF NOT EXISTS loans (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    book_id     INT NOT NULL,
    user_id     INT NOT NULL,
    loan_date   DATE NOT NULL,
    due_date    DATE NOT NULL,
    return_date DATE,
    status      ENUM('active','returned','overdue') DEFAULT 'active',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================================
-- DONNÉES DE TEST — LIVRES
-- ==========================================================
INSERT INTO books (title, author, isbn, description, category, quantity, available) VALUES
('Clean Code', 'Robert C. Martin', '978-0132350884', 'A guide to writing clean, maintainable code.', 'Informatique', 3, 3),
('The Pragmatic Programmer', 'David Thomas', '978-0135957059', 'Tips and tricks for software development.', 'Informatique', 2, 2),
("Introduction à l'Intelligence Artificielle", 'Stuart Russell', '978-2100780464', "Fondamentaux de l'IA.", 'Intelligence Artificielle', 4, 4),
('DevOps Handbook', 'Gene Kim', '978-1950508402', 'Guide pratique du DevOps.', 'DevOps', 2, 2),
('Docker Deep Dive', 'Nigel Poulton', '978-1521822807', 'Maîtriser Docker en profondeur.', 'DevOps', 3, 3);

-- ==========================================================
-- DONNÉES DE TEST — UTILISATEURS
-- ==========================================================
INSERT INTO users (name, email, type, phone, student_id) VALUES
('Moussa Diallo',    'moussa.diallo@dit.sn', 'Etudiant',                '+221770000001', 'DIT2024001'),
('Fatou Ndiaye',     'fatou.ndiaye@dit.sn',  'Etudiant',                '+221770000002', 'DIT2024002'),
('Dr. Ibrahima Sow', 'ibrahima.sow@dit.sn',  'Professeur',              '+221770000003',  NULL),
('Aminata Diop',     'aminata.diop@dit.sn',  'Personnel administratif', '+221770000004',  NULL),
('Oumar Ba',         'oumar.ba@dit.sn',      'Etudiant',                '+221770000005', 'DIT2024005');

-- ==========================================================
-- DONNÉES DE TEST — EMPRUNTS
-- ==========================================================
INSERT INTO loans (book_id, user_id, loan_date, due_date, status) VALUES
(1, 1, CURDATE() - INTERVAL 5  DAY, CURDATE() + INTERVAL 9 DAY, 'active'),
(3, 2, CURDATE() - INTERVAL 20 DAY, CURDATE() - INTERVAL 6 DAY, 'overdue');
