@Library('apim-jenkins-lib@master') _

pipeline {
    agent { label 'default' }
    environment {
        ARTIFACTORY_CREDS = credentials('ARTIFACTORY_USERNAME_TOKEN')
        ARTIFACTORY_USER = "$ARTIFACTORY_CREDS_USR"
        ARTIFACTORY_PASSWORD = "$ARTIFACTORY_CREDS_PSW"
        ARTIFACTORY_ARTIFACT_PATH = 'https://usw1.packages.broadcom.com/artifactory'
        ARTIFACTORY_UPLOAD_PATH = "${env.ARTIFACTORY_ARTIFACT_PATH}/apim-npm-dev-local/graphman-client/"
    }
    parameters {
        string(name: 'VAR_jdk_version', defaultValue: 'jdk11.0.18_10', description: 'JDK Version')
        booleanParam(
            defaultValue: false,
            description: 'true to publish the build artifacts to the artifactory.',
            name: 'PUBLISH_TO_ARTIFACTORY'
        )
    }
    stages {
        stage('Update Java') {
             steps {
                 script {
                     sh 'java -version'
                     sh 'cd /usr/java; rm -rf default; ln -s ${VAR_jdk_version} default'
                     sh 'cd /usr/java; rm -rf latest; ln -s ${VAR_jdk_version} latest'
                     jdk_path="/usr/java/${VAR_jdk_version}"
                     sh 'java -version'
                  }
              }
         }
        stage("Build") {
            steps {
                echo "Building graphman-client ..."
                script {
                    sh './build.sh ${ARTIFACTORY_USER} ${ARTIFACTORY_PASSWORD}'
                    sh "mkdir -p BuildArtifact"
                    sh "du -h"
                    sh "cp ./build/dist/layer7-graphman* BuildArtifact"
                }
            }
        }
        stage('Publish to Artifactory') {
            when { expression { params.PUBLISH_TO_ARTIFACTORY }}
            steps {
                sh '''
                   export layer7Graphman=$(ls -d ./build/dist/layer7-graphman-1*)
                   export layer7GraphmanWrapper=$(ls -d ./build/dist/layer7-graphman-w*)

                   curl -v -i -u $ARTIFACTORY_CREDS_USR:$ARTIFACTORY_CREDS_PSW  -T ${layer7Graphman}  "${ARTIFACTORY_UPLOAD_PATH}"
                   curl -v -i -u $ARTIFACTORY_CREDS_USR:$ARTIFACTORY_CREDS_PSW  -T ${layer7GraphmanWrapper}  "${ARTIFACTORY_UPLOAD_PATH}"

                   '''
                echo "published Graphman-client artifacts to artifactory"
           }
       }
    }

    post {
        always {
          script {
               archiveArtifacts artifacts: "BuildArtifact/**/*", allowEmptyArchive: true
          }
          echo "end"
       }
   }
}
