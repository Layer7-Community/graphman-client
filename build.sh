
distDir=build/dist
packageDir=build/graphman
wrapperDir=build/graphman-cli

# copy required files to build main package
echo cleaning build directory

rm -rf build/
mkdir build
mkdir -p $distDir
mkdir -p $packageDir
mkdir -p $wrapperDir

echo building [@layer7/graphman] package
cp -r modules $packageDir/
cp -r queries $packageDir/
cp -r schema $packageDir/
cp LICENSE.md $packageDir/
cp package.json $packageDir/
pushd $packageDir>/dev/null
rm -rf modules/graphman-extension-*.js
npm pack
popd>/dev/null

# copy required files to build wrapper package
mkdir $wrapperDir/modules
mkdir $wrapperDir/queries
cp modules/graphman-extension-*.js $wrapperDir/modules/.
cp cli-main.js $wrapperDir/.
cp graphman.* $wrapperDir/.
cp LICENSE.md $wrapperDir/
pushd build>/dev/null
tar -czvf graphman-cli.tar.gz *-cli
popd>/dev/null

mv $packageDir/*.tgz build/dist/.

distPkg=$(ls -d ./build/dist/graphman-*.tgz)
distPkg=${distPkg/graphman/graphman-cli}
distPkg={distPkg/%.tgz/.tar.gz}
mv build/*.tar.gz $distPkg
echo build completed
echo distribution packages
ls -l build/dist
