pipeline {
    agent any

    environment {
        PROJECT_NAME    = 'bibliotheque-numerique'
        COMPOSE_FILE    = 'docker-compose.yml'
        DOCKER_REGISTRY = ''   // ex: 'registry.hub.docker.com/mon-user'
        GIT_REPO        = 'https://github.com/maihelene/bibliotheque-dit.git'
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '5'))
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
    }

    stages {

        // ----------------------------------------------------------
        stage('🔁 Récupération du code') {
        // ----------------------------------------------------------
            steps {
                echo '📥 Clonage du dépôt GitHub...'
                checkout scm
                echo "✅ Code récupéré — Branche: ${env.GIT_BRANCH} | Commit: ${env.GIT_COMMIT?.take(7)}"
            }
        }

        // ----------------------------------------------------------
        stage('🔍 Vérification de l\'environnement') {
        // ----------------------------------------------------------
            steps {
                echo '🔎 Vérification des outils installés...'
                sh '''
                    echo "=== Docker ==="
                    docker --version
                    echo "=== Docker Compose ==="
                    docker compose version
                    echo "=== Node.js ==="
                    node --version || echo "Node.js non disponible sur l\'agent"
                    echo "=== Espace disque ==="
                    df -h
                '''
            }
        }

        // ----------------------------------------------------------
        stage('📦 Construction des images Docker') {
        // ----------------------------------------------------------
            parallel {
				stage('Image Authentification Service') {
                    steps {
                        echo '🔨 Build image authentification-service...'
                        sh 'docker build -t ${PROJECT_NAME}-authentification:${BUILD_NUMBER} ./services/authentification-service'
                        sh 'docker tag ${PROJECT_NAME}-authentification:${BUILD_NUMBER} ${PROJECT_NAME}-authentification:latest'
                    }
                }
                stage('Image Books Service') {
                    steps {
                        echo '🔨 Build image books-service...'
                        sh 'docker build -t ${PROJECT_NAME}-books:${BUILD_NUMBER} ./services/books-service'
                        sh 'docker tag ${PROJECT_NAME}-books:${BUILD_NUMBER} ${PROJECT_NAME}-books:latest'
                    }
                }
                stage('Image Users Service') {
                    steps {
                        echo '🔨 Build image users-service...'
                        sh 'docker build -t ${PROJECT_NAME}-users:${BUILD_NUMBER} ./services/users-service'
                        sh 'docker tag ${PROJECT_NAME}-users:${BUILD_NUMBER} ${PROJECT_NAME}-users:latest'
                    }
                }
                stage('Image Loans Service') {
                    steps {
                        echo '🔨 Build image loans-service...'
                        sh 'docker build -t ${PROJECT_NAME}-loans:${BUILD_NUMBER} ./services/loans-service'
                        sh 'docker tag ${PROJECT_NAME}-loans:${BUILD_NUMBER} ${PROJECT_NAME}-loans:latest'
                    }
                }
                stage('Image Frontend') {
                    steps {
                        echo '🔨 Build image frontend...'
                        sh 'docker build -t ${PROJECT_NAME}-frontend:${BUILD_NUMBER} ./frontend'
                        sh 'docker tag ${PROJECT_NAME}-frontend:${BUILD_NUMBER} ${PROJECT_NAME}-frontend:latest'
                    }
                }
            }
        }

        // ----------------------------------------------------------
        stage('🧪 Tests de santé des images') {
        // ----------------------------------------------------------
            steps {
                echo '🔬 Vérification des images construites...'
                sh '''
                    echo "Images disponibles :"
                    docker images | grep ${PROJECT_NAME}
                '''
            }
        }

        // ----------------------------------------------------------
        stage('🛑 Arrêt des conteneurs existants') {
        // ----------------------------------------------------------
            steps {
                echo '⏹ Arrêt des anciens conteneurs...'
                sh '''
                    docker compose -f ${COMPOSE_FILE} down --remove-orphans || true
                '''
            }
        }

        // ----------------------------------------------------------
        stage('🚀 Déploiement avec Docker Compose') {
        // ----------------------------------------------------------
            steps {
                echo '🚀 Lancement de l\'application...'
                sh '''
                    docker compose -f ${COMPOSE_FILE} up -d --build
                    echo "⏳ Attente du démarrage des services (30s)..."
                    sleep 30
                '''
            }
        }

        // ----------------------------------------------------------
        stage('✅ Vérification des services') {
        // ----------------------------------------------------------
            steps {
                echo '🔍 Health checks des microservices...'
                sh '''
                    echo "=== Conteneurs en cours d\'exécution ==="
                    docker compose -f ${COMPOSE_FILE} ps

                    echo ""
                    echo "=== Health check Authentification Service ==="
                    curl -f http://localhost:3000/health && echo "✅ Authentification OK" || echo "❌ Authentification KO"

                    echo "=== Health check Books Service ==="
                    curl -f http://localhost:3001/health && echo "✅ Books OK" || echo "❌ Books KO"

                    echo "=== Health check Users Service ==="
                    curl -f http://localhost:3002/health && echo "✅ Users OK" || echo "❌ Users KO"

                    echo "=== Health check Loans Service ==="
                    curl -f http://localhost:3003/health && echo "✅ Loans OK" || echo "❌ Loans KO"

                    echo "=== Frontend ==="
                    curl -f http://localhost:80 && echo "✅ Frontend OK" || echo "❌ Frontend KO"
                '''
            }
        }

        // ----------------------------------------------------------
        stage('📊 Logs de déploiement') {
        // ----------------------------------------------------------
            steps {
                echo '📜 Logs des services...'
                sh '''
                    echo "=== Authentification Service logs ==="
                    docker logs bibliotheque-authentification --tail=20

                    echo "=== Books Service logs ==="
                    docker logs bibliotheque-books --tail=20

                    echo "=== Users Service logs ==="
                    docker logs bibliotheque-users --tail=20

                    echo "=== Loans Service logs ==="
                    docker logs bibliotheque-loans --tail=20
                '''
            }
        }
    }

    post {
        success {
            echo """
            ============================================
            ✅ DÉPLOIEMENT RÉUSSI — Build #${BUILD_NUMBER}
            ============================================
            🌐 Frontend     : http://localhost:8084
    Authentification API    : http://localhost:3000/api/health
            📚 Books API    : http://localhost:3001/api/books
            👤 Users API    : http://localhost:3002/api/users
            📋 Loans API    : http://localhost:3003/api/loans
            ============================================
            """
        }
        failure {
            echo '❌ Le pipeline a échoué. Consultation des logs recommandée.'
            sh 'docker compose -f ${COMPOSE_FILE} logs --tail=50 || true'
        }
        always {
            echo '🧹 Nettoyage des images Docker inutilisées...'
            sh 'docker image prune -f || true'
        }
    }
}
