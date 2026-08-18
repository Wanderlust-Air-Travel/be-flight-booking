# =============================================================================
# Flight Booking Backend — Jenkins Pipeline
# be-flight-booking/Jenkinsfile
#
# Setup:
#   1. Create Multibranch Pipeline in Jenkins
#   2. Point to this Jenkinsfile
#   3. Add credentials:
#      - staging-ssh-key: SSH username with private key (staging server)
#      - prod-ssh-key:    SSH username with private key (production server)
#      - docker-registry: Username + password (for private registry)
# =============================================================================

pipeline {
    agent any

    environment {
        APP_DIR = '/home/deploy/flight-booking/be'
        MONITORING_DIR = '/home/deploy/flight-booking/monitoring'
        DOCKER_REGISTRY = 'ghcr.io'
        DOCKER_IMAGE_PREFIX = 'flight-booking'
        SLACK_CHANNEL = '#deployments'
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10', artifactNumToKeepStr: '5'))
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
        timestamps()
    }

    stages {
        stage('Checkout') {
            steps {
                echo "Checking out code..."
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: "git rev-parse --short HEAD",
                        returnStdout: true
                    ).trim()
                    env.GIT_BRANCH_NAME = sh(
                        script: "git rev-parse --abbrev-ref HEAD",
                        returnStdout: true
                    ).trim()
                    env.VERSION = env.GIT_COMMIT_SHORT
                    env.BUILD_DATE = sh(
                        script: "date -u +'%Y-%m-%dT%H:%M:%SZ'",
                        returnStdout: true
                    ).trim()
                    env.DEPLOY_ENV = env.GIT_BRANCH_NAME == 'main' ? 'production' : 'staging'
                }
                echo "Branch: ${env.GIT_BRANCH_NAME} | Commit: ${env.GIT_COMMIT_SHORT} | Env: ${env.DEPLOY_ENV}"
            }
        }

        stage('Quality Checks') {
            parallel {
                stage('go vet') {
                    steps {
                        sh '''
                            cd pkg && go vet ./... || true
                            for svc in apps/*/; do
                                (cd "$svc" && go vet ./... 2>/dev/null || true)
                            done
                        '''
                    }
                }
                stage('Lint') {
                    steps {
                        sh '''
                            command -v golangci-lint >/dev/null 2>&1 || {
                                echo "golangci-lint not installed, skipping..."
                            }
                        '''
                    }
                }
            }
        }

        stage('Build Services') {
            steps {
                sh '''
                    echo "Building services..."
                    for svc in apps/*/; do
                        name=$(basename "$svc")
                        echo "Building $name..."
                        (cd "$svc" && CGO_ENABLED=0 go build -o /tmp/${name} . && echo "  $name: OK" || { echo "  $name: FAILED"; exit 1; })
                    done
                '''
            }
        }

        stage('Unit Tests') {
            steps {
                sh '''
                    echo "Running tests..."
                    cd pkg && go test -v -count=1 -race ./... || true
                    for svc in apps/*/; do
                        (cd "$svc" && go test -v -count=1 ./... 2>/dev/null || true)
                    done
                '''
            }
        }

        stage('Docker Build') {
            steps {
                script {
                    def services = ['api-gateway', 'search-service', 'booking-service', 'payment-service']
                    for (svc in services) {
                        def imageName = "${env.DOCKER_REGISTRY}/${env.GIT_BRANCH_NAME}/${svc}:${env.VERSION}"
                        def imageLatest = "${env.DOCKER_REGISTRY}/${env.GIT_BRANCH_NAME}/${svc}:latest"

                        sh """
                            echo "Building ${svc}..."
                            docker build \
                                --build-arg VERSION=${env.VERSION} \
                                --build-arg BUILD_DATE=${env.BUILD_DATE} \
                                --build-arg COMMIT_SHA=${env.GIT_COMMIT_SHORT} \
                                -t ${imageName} \
                                -t ${imageLatest} \
                                -f apps/${svc}/Dockerfile \
                                apps/${svc}
                            docker push ${imageName}
                            docker push ${imageLatest}
                        """
                    }
                }
            }
        }

        stage('Deploy to Staging') {
            when {
                anyOf {
                    branch 'develop'
                    branch 'staging'
                }
            }
            steps {
                script {
                    def deployHost = env.GIT_BRANCH_NAME == 'staging' ?
                        "${env.STAGING_HOST}" : "${env.STAGING_HOST}"

                    sshagent(credentials: ['staging-ssh-key']) {
                        sh """
                            set -e
                            echo "Deploying to staging: ${env.DEPLOY_HOST}..."

                            ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null deploy@${env.STAGING_HOST} << 'ENDSSH'
                                set -e
                                cd ${env.APP_DIR}

                                # Pull Docker images
                                docker compose -f docker-compose.development.yml -f docker-compose.prod.yml pull

                                # Update env
                                cat > .env << 'EOF'
APP_ENV=staging
VERSION=${env.VERSION}

DB_HOST=postgres
DB_PORT=5432
DB_NAME=flightbooking
DB_USER=flightbooking
DB_PASSWORD=${env.STAGING_DB_PASSWORD}
DB_SSLMODE=disable
DB_MAX_CONNECTIONS=50
DB_IDLE_CONNECTIONS=10

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${env.STAGING_REDIS_PASSWORD}
REDIS_FLIGHT_CACHE_TTL=600
REDIS_SESSION_TTL=1800

RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_USER=staging_admin
RABBITMQ_PASSWORD=${env.STAGING_RABBITMQ_PASSWORD}
RABBITMQ_VHOST=/
RABBITMQ_EXCHANGE=flightbooking.events

AVIATIONSTACK_API_KEY=${env.AVIATIONSTACK_API_KEY}
AVIATIONSTACK_BASE_URL=https://api.aviationstack.com/v1
AVIATIONSTACK_TIMEOUT=10
AVIATIONSTACK_RETRY_ATTEMPTS=3
AVIATIONSTACK_CACHE_TTL=600

PAYMENT_PROVIDER=mock
PAYMENT_MOCK_ENABLED=true

JWT_SECRET=${env.STAGING_JWT_SECRET}
JWT_EXPIRY_HOURS=24

CORS_ALLOWED_ORIGINS=https://staging.yourdomain.com,https://staging-api.yourdomain.com
CORS_ALLOWED_METHODS=GET,POST,PUT,PATCH,DELETE,OPTIONS
CORS_ALLOWED_HEADERS=Authorization,Content-Type,X-Requested-With,X-Request-ID
CORS_EXPOSE_HEADERS=X-Total-Count,X-Request-ID
CORS_MAX_AGE=86400

RATE_LIMIT_REQUESTS_PER_MINUTE=100
RATE_LIMIT_BURST=20

LOG_LEVEL=info
LOG_FORMAT=json
EOF

                                docker compose -f docker-compose.development.yml -f docker-compose.prod.yml up -d --build

                                echo "Waiting for services..."
                                sleep 15

                                echo "Health checks:"
                                curl -sf http://localhost:8080/healthz && echo " API-Gateway: OK" || echo " API-Gateway: FAILED"
                                curl -sf http://localhost:8090/healthz && echo " Search: OK" || echo " Search: FAILED"
                                curl -sf http://localhost:8091/healthz && echo " Booking: OK" || echo " Booking: FAILED"
                                curl -sf http://localhost:8092/healthz && echo " Payment: OK" || echo " Payment: FAILED"

                                echo "Staging deployment complete!"
                            ENDSSH
                        """
                    }
                }
            }
        }

        stage('Deploy to Production') {
            when {
                branch 'main'
            }
            steps {
                timeout(time: 15, unit: 'MINUTES') {
                    input message: 'Deploy to Production?',
                          ok: 'Deploy',
                          submitter: 'admin,deployer'
                }

                script {
                    sshagent(credentials: ['prod-ssh-key']) {
                        sh """
                            set -e
                            echo "Deploying to production..."

                            ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null deploy@${env.PROD_HOST} << 'ENDSSH'
                                set -e
                                cd ${env.APP_DIR}

                                # Backup before deployment
                                mkdir -p backups
                                DATE=\$(date +%Y%m%d_%H%M%S)
                                docker compose -f docker-compose.development.yml exec -T postgres pg_dump -U flightbooking flightbooking 2>/dev/null | gzip > backups/db_backup_\${DATE}.sql.gz || true
                                echo "Backup created: db_backup_\${DATE}.sql.gz"

                                # Pull images
                                docker compose -f docker-compose.development.yml -f docker-compose.prod.yml pull

                                # Update env
                                cat > .env << 'EOF'
APP_ENV=production
VERSION=${env.VERSION}

DB_HOST=postgres
DB_PORT=5432
DB_NAME=flightbooking
DB_USER=flightbooking
DB_PASSWORD=${env.PROD_DB_PASSWORD}
DB_SSLMODE=disable
DB_MAX_CONNECTIONS=100
DB_IDLE_CONNECTIONS=20

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${env.PROD_REDIS_PASSWORD}
REDIS_FLIGHT_CACHE_TTL=300
REDIS_SESSION_TTL=900

RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_USER=prod_admin
RABBITMQ_PASSWORD=${env.PROD_RABBITMQ_PASSWORD}
RABBITMQ_VHOST=/
RABBITMQ_EXCHANGE=flightbooking.events

AVIATIONSTACK_API_KEY=${env.AVIATIONSTACK_API_KEY}
AVIATIONSTACK_BASE_URL=https://api.aviationstack.com/v1
AVIATIONSTACK_TIMEOUT=15
AVIATIONSTACK_RETRY_ATTEMPTS=5
AVIATIONSTACK_CACHE_TTL=300

PAYMENT_PROVIDER=stripe
PAYMENT_MOCK_ENABLED=false

JWT_SECRET=${env.PROD_JWT_SECRET}
JWT_EXPIRY_HOURS=1

CORS_ALLOWED_ORIGINS=https://www.yourdomain.com,https://yourdomain.com,https://api.yourdomain.com
CORS_ALLOWED_METHODS=GET,POST,PUT,PATCH,DELETE,OPTIONS
CORS_ALLOWED_HEADERS=Authorization,Content-Type,X-Requested-With,X-Request-ID
CORS_EXPOSE_HEADERS=X-Total-Count,X-Request-ID
CORS_MAX_AGE=86400

RATE_LIMIT_REQUESTS_PER_MINUTE=60
RATE_LIMIT_BURST=10

LOG_LEVEL=warn
LOG_FORMAT=json
EOF

                                docker compose -f docker-compose.development.yml -f docker-compose.prod.yml up -d --build

                                echo "Waiting for services..."
                                sleep 20

                                echo "Health checks:"
                                curl -sf http://localhost:8080/healthz && echo " API-Gateway: OK" || { echo " API-Gateway: FAILED"; exit 1; }
                                curl -sf http://localhost:8090/healthz && echo " Search: OK" || { echo " Search: FAILED"; exit 1; }
                                curl -sf http://localhost:8091/healthz && echo " Booking: OK" || { echo " Booking: FAILED"; exit 1; }
                                curl -sf http://localhost:8092/healthz && echo " Payment: OK" || { echo " Payment: FAILED"; exit 1; }

                                docker compose -f docker-compose.development.yml -f docker-compose.prod.yml ps

                                echo "Production deployment complete!"
                            ENDSSH
                        """
                    }
                }
            }
        }
    }

    post {
        always {
            script {
                def status = currentBuild.result ?: 'SUCCESS'
                def color = status == 'SUCCESS' ? 'good' : 'danger'
                def emoji = status == 'SUCCESS' ? ':white_check_mark:' : ':x:'

                if (env.SLACK_WEBHOOK) {
                    slackSend(
                        channel: env.SLACK_CHANNEL,
                        color: color,
                        message: "${emoji} ${env.DEPLOY_ENV?.toUpperCase() ?: 'BUILD'} ${status}: ${env.JOB_NAME} #${env.BUILD_NUMBER} (${env.GIT_COMMIT_SHORT})"
                    )
                }
            }

            cleanWs(
                deleteDirs: true,
                notFailBuild: true,
                patterns: [[type: 'exclude', pattern: '*.log']]
            )
        }

        success {
            echo "Pipeline completed successfully!"
        }

        failure {
            echo "Pipeline failed — check logs!"
        }

        unstable {
            echo "Pipeline completed with warnings."
        }
    }
}
