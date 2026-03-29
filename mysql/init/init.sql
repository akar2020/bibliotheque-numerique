-- ==========================================================
-- BIBLIOTHÈQUE NUMÉRIQUE DIT - SCRIPT COMPLET ACTUALISÉ
-- Basé sur l'export biblio_dit avec gestion des exemplaires
-- ==========================================================

CREATE DATABASE IF NOT EXISTS `biblio_dit` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE `biblio_dit`;

-- Désactivation temporaire des clés étrangères pour le nettoyage
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `loans`;
DROP TABLE IF EXISTS `book_copies`;
DROP TABLE IF EXISTS `books`;
DROP TABLE IF EXISTS `users`;
SET FOREIGN_KEY_CHECKS = 1;

-- ==========================================================
-- 1. TABLE : BOOKS (Informations bibliographiques)
-- ==========================================================
CREATE TABLE `books` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `author` VARCHAR(255) NOT NULL,
  `isbn` VARCHAR(30) UNIQUE NOT NULL,
  `description` TEXT,
  `category` VARCHAR(100),
  `quantity` INT DEFAULT 0,    -- Ajouté pour syncBookCounters
  `available` INT DEFAULT 0,   -- Ajouté pour syncBookCounters
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ==========================================================
-- 2. TABLE : BOOK_COPIES (Unités physiques avec Code-barres)
-- ==========================================================
CREATE TABLE `book_copies` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `book_id` INT NOT NULL,
  `barcode` VARCHAR(50) UNIQUE NOT NULL,
  `status` ENUM('available', 'loaned', 'damaged', 'lost') DEFAULT 'available',
  `added_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_copy_book` FOREIGN KEY (`book_id`) REFERENCES `books` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==========================================================
-- 3. TABLE : USERS (Avec sécurité Auth)
-- ==========================================================
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) UNIQUE NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `type` ENUM('Etudiant','Professeur','Personnel administratif') DEFAULT 'Etudiant',
  `phone` VARCHAR(20),
  `student_id` VARCHAR(50),
  `refresh_token` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ==========================================================
-- 4. TABLE : LOANS (Gestion des emprunts par exemplaire)
-- ==========================================================
CREATE TABLE `loans` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `copy_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `loan_date` DATE NOT NULL,
  `due_date` DATE NOT NULL,
  `return_date` DATE DEFAULT NULL,
  `status` ENUM('active', 'returned', 'overdue') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_loan_copy` FOREIGN KEY (`copy_id`) REFERENCES `book_copies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_loan_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==========================================================
-- INSERTION DES DONNÉES DE TEST
-- ==========================================================

-- Insertion des livres
INSERT INTO `books` (`id`, `title`, `author`, `isbn`, `description`, `category`) VALUES
(1, 'Clean Code', 'Robert C. Martin', '978-0132350884', 'A guide to writing clean code.', 'Informatique'),
(2, 'The Pragmatic Programmer', 'David Thomas', '978-0135957059', 'Tips for software development.', 'Informatique');

-- Insertion des exemplaires (2 pour Clean Code, 1 pour Pragmatic)
INSERT INTO `book_copies` (`book_id`, `barcode`, `status`) VALUES
(1, 'BC-CLEAN-001', 'loaned'),
(1, 'BC-CLEAN-002', 'available'),
(2, 'BC-PRAG-001', 'available');

-- Insertion des utilisateurs (Le mot de passe 'TEMP_PASS' doit être hashé en prod)
INSERT INTO `users` (`id`, `name`, `email`, `password`, `type`, `student_id`) VALUES
(1, 'Moussa Diallo', 'kaka_abba@ymail.com', '$2a$10$EIXV...', 'Etudiant', 'DIT2024001'),
(2, 'Fatou Ndiaye', 'fatou.ndiaye@dit.sn', '$2a$10$EIXV...', 'Etudiant', 'DIT2024002'),
(3, 'Admin', 'admin@dit.sn', '$2a$10$EIXV...', 'Personnel administratif', 'DIT2024_ADM'); -- Changé pour éviter le doublon
-- Insertion d'un emprunt actif (sur l'exemplaire n°1)
INSERT INTO `loans` (`copy_id`, `user_id`, `loan_date`, `due_date`, `status`) VALUES
(1, 1, CURDATE() - INTERVAL 5 DAY, CURDATE() + INTERVAL 9 DAY, 'active');