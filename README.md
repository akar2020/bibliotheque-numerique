# 📚 Bibliothèque Numérique — DIT

> **Projet DevOps — Master 1 Intelligence Artificielle**  
> Dakar Institute of Technology (DIT) | Mars 2026

Application web de gestion de bibliothèque académique basée sur une **architecture microservices**, conteneurisée avec **Docker** et déployée via un pipeline **CI/CD Jenkins**.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                           │
│              HTML / CSS / JS  (Nginx:80)                │
└──────────────────┬──────────────────────────────────────┘
                   │ HTTP REST
     ┌─────────────┼──────────────────────────┐
     ▼             ▼             ▼            ▼
┌─────────┐  ┌─────────┐    ┌─────────┐  ┌─────────┐
│  Auths  │  │  Books  │    │  Users  │  │  Loans  │
│ Service │  │ Service │    │ Service │  │ Service │
│  :3000  │  │  :3001  │    │  :3002  │  │  :3003  │
└────┬────┘  └────┬────┘    └────┬────┘  └────┬────┘
     │            │              │            │
     └────────────┼──────────────┘────────────┘
                   ▼
            ┌─────────────┐
            │    MySQL    │
            │    :3306    │
            └─────────────┘
```

## 🛠️ Technologies

| Composant       | Technologie              |
|----------------|--------------------------|
| Backend         | Node.js + Express        |
| Frontend        | HTML / CSS / JavaScript  |
| Base de données | MySQL 8.0                |
| Conteneurisation| Docker + Docker Compose  |
| CI/CD           | Jenkins                  |
| Serveur web     | Nginx (frontend)         |

---

## 🚀 Installation et lancement

### Prérequis

- [Docker](https://docs.docker.com/get-docker/) ≥ 24.x
- [Docker Compose](https://docs.docker.com/compose/) ≥ 2.x
- [Git](https://git-scm.com/)

### 1. Cloner le dépôt

```bash
git clone https://github.com/VOTRE_USERNAME/bibliotheque-numerique.git
cd bibliotheque-numerique
```

### 2. Lancer avec Docker Compose

```bash
docker compose up -d --build
```

> La première fois, MySQL peut prendre 30–60 secondes à démarrer. Les services redémarrent automatiquement jusqu'à ce que la DB soit disponible.

### 3. Vérifier que tout fonctionne

```bash
docker compose ps
```

| Service             | URL                              |
|---------------------|----------------------------------|
| Frontend            | http://localhost:80              |
| Authentification    | http://localhost:3001/api/books  |
| Books API           | http://localhost:3001/api/books  |
| Users API           | http://localhost:3002/api/users  |
| Loans API           | http://localhost:3003/api/loans  |
| Health Books        | http://localhost:3001/health     |
| Health Users        | http://localhost:3002/health     |
| Health Loans        | http://localhost:3003/health     |

### 4. Arrêter l'application

```bash
docker compose down
```

Pour tout supprimer (volumes inclus) :

```bash
docker compose down -v
```

---

## 📁 Structure du projet

```
bibliotheque-numerique/
├── services/
│   ├── authentification-service/        # Microservice Authentification
│   │   ├── src/
│   │   │   ├── controllers/authentificationController.js
│   │   │   ├── routes/authentification.js
│   │   │   ├── db.js
│   │   │   └── index.js
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── books-service/        # Microservice Livres
│   │   ├── src/
│   │   │   ├── controllers/booksController.js
│   │   │   ├── routes/books.js
│   │   │   ├── db.js
│   │   │   └── index.js
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── users-service/        # Microservice Utilisateurs
│   │   ├── src/
│   │   │   ├── controllers/usersController.js
│   │   │   ├── routes/users.js
│   │   │   ├── db.js
│   │   │   └── index.js
│   │   ├── Dockerfile
│   │   └── package.json
│   └── loans-service/        # Microservice Emprunts
│       ├── src/
│       │   ├── controllers/loansController.js
│       │   ├── routes/loans.js
│       │   ├── db.js
│       │   └── index.js
│       ├── Dockerfile
│       └── package.json
├── frontend/                 # Interface web
│   ├── css/style.css
│   ├── js/
│   │   ├── api.js
│   │   ├── app.js
│   │   ├── dashboard.js
│   │   ├── books.js
│   │   ├── users.js
│   │   └── loans.js
│   ├── index.html
│   ├── nginx.conf
│   └── Dockerfile
├── mysql/
│   └── init/init.sql         # Script d'initialisation BDD
├── docker-compose.yml
├── Jenkinsfile
├── .gitignore
└── README.md
```

---

## 🔌 API Reference

### Books Service (`localhost:3001`)

| Méthode | Endpoint                        | Description                    |
|---------|---------------------------------|--------------------------------|
| GET     | `/api/books`                    | Lister tous les livres         |
| GET     | `/api/books/search?q=mot`       | Rechercher (titre/auteur/ISBN) |
| GET     | `/api/books/:id`                | Obtenir un livre               |
| POST    | `/api/books`                    | Ajouter un livre               |
| PUT     | `/api/books/:id`                | Modifier un livre              |
| DELETE  | `/api/books/:id`                | Supprimer un livre             |
| PATCH   | `/api/books/:id/availability`   | Mettre à jour disponibilité    |

### Users Service (`localhost:3002`)

| Méthode | Endpoint                  | Description                      |
|---------|---------------------------|----------------------------------|
| GET     | `/api/users`              | Lister les utilisateurs          |
| GET     | `/api/users?type=Etudiant`| Filtrer par type                 |
| GET     | `/api/users/:id`          | Obtenir un utilisateur           |
| POST    | `/api/users`              | Créer un utilisateur             |
| PUT     | `/api/users/:id`          | Modifier un utilisateur          |
| DELETE  | `/api/users/:id`          | Supprimer un utilisateur         |

### Loans Service (`localhost:3003`)

| Méthode | Endpoint                    | Description                  |
|---------|-----------------------------|------------------------------|
| GET     | `/api/loans`                | Lister tous les emprunts     |
| GET     | `/api/loans/overdue`        | Emprunts en retard           |
| GET     | `/api/loans/history`        | Historique complet           |
| GET     | `/api/loans/user/:userId`   | Emprunts par utilisateur     |
| POST    | `/api/loans`                | Créer un emprunt             |
| PUT     | `/api/loans/:id/return`     | Retourner un livre           |

---

## 🔄 Pipeline CI/CD Jenkins

### Configuration Jenkins

1. Installer Jenkins et les plugins : **Git**, **Docker Pipeline**, **Pipeline**
2. Créer un nouveau job de type **Pipeline**
3. Configurer le dépôt GitHub et pointer sur le `Jenkinsfile`

### Étapes du pipeline

```
Récupération du code (GitHub)
        │
        ▼
Vérification de l'environnement
        │
        ▼
Build des images Docker (en parallèle)
  ┌─────┬─────┬─────────┐
  │Books│Users│Loans    │Frontend
  └─────┴─────┴─────────┘
        │
        ▼
Tests de santé des images
        │
        ▼
Arrêt des anciens conteneurs
        │
        ▼
Déploiement avec Docker Compose
        │
        ▼
Vérification des health checks
        │
        ▼
Rapport de déploiement
```

### Lancer le pipeline manuellement

```bash
# Depuis l'interface Jenkins : Build Now
# Ou via l'API Jenkins :
curl -X POST http://JENKINS_URL/job/bibliotheque-numerique/build
```

---

## 📊 Données de démonstration

Le script `mysql/init/init.sql` insère automatiquement :

- **5 livres** (Clean Code, Pragmatic Programmer, IA, DevOps Handbook, Docker)
- **5 utilisateurs** (étudiants, professeur, personnel)
- **2 emprunts** (dont 1 en retard pour tester la détection)

---

## 👥 Équipe

Projet réalisé dans le cadre de l'examen pratique DevOps  
**Master 1 Intelligence Artificielle — DIT Dakar, 2026**
