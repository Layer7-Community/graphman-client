@Library('apim-jenkins-lib@master') _

pipeline {
    agent { label 'default' }
    environment {
        ARTIFACTORY_CREDS = credentials('ARTIFACTORY_USERNAME_TOKEN')
        ARTIFACTORY_ARTIFACT_PATH = 'usw1.packages.broadcom.com/artifactory'
        ARTIFACTORY_ARTIFACT_NPM_PATH = "${env.ARTIFACTORY_ARTIFACT_PATH}/api/npm/apim-npm-dev-local/"
        ARTIFACTORY_UPLOAD_PATH = "${env.ARTIFACTORY_ARTIFACT_PATH}/apim-npm-dev-local/@layer7/graphman/-/@layer7/"
        ARTIFACTORY_EMAIL = 'bld-apim.teamcity@broadcom.com'
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
                    sh './build.sh'
                    sh "mkdir -p BuildArtifact"
                    sh "du -h"
                    sh "cp ./build/dist/layer7-graphman-* BuildArtifact"
                }
            }
        }
        stage('Publish to Artifactory') {
            when { expression { params.PUBLISH_TO_ARTIFACTORY }}
            steps {
                sh '''
                   echo prepare per-project npmrc file
                   artifactoryCredentials=$(echo -n $ARTIFACTORY_CREDS_USR:$ARTIFACTORY_CREDS_PSW|base64 --wrap=0)
                   echo registry=https://$ARTIFACTORY_ARTIFACT_NPM_PATH > ./.npmrc
                   echo _auth=$artifactoryCredentials >> ./.npmrc
                   echo email=$ARTIFACTORY_EMAIL >> ./.npmrc
                   echo always-auth=true >> ./.npmrc
                   cat ./.npmrc

                   echo start publishing the artifacts
                   layer7Graphman=$(ls -d ./build/dist/layer7-graphman-*.tgz)
                   layer7GraphmanWrapper=$(ls -d ./build/dist/layer7-graphman-cli-*.tar.gz)
                   npm publish ${layer7Graphman} --registry https://${ARTIFACTORY_ARTIFACT_NPM_PATH}
                   curl -v -i -u $ARTIFACTORY_CREDS_USR:$ARTIFACTORY_CREDS_PSW  -T ${layer7GraphmanWrapper}  "${ARTIFACTORY_UPLOAD_PATH}"
                   rm -rf ./.npmrc
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
