ignore_files=".git|node_modules|_templates|customize.sh|README.md|use-as-template.png"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'

for input_file in `tree -I "${ignore_files}" -Ffai --noreport`
do
  if [ ! -d "${input_file}" ]; then
    echo "Processing file: ${input_file}"
    npx ejs "${input_file}" -o "${input_file}" -f ./data.json
  fi
done

# Setup husky
npx husky install
npx husky add .husky/commit-msg 'npx --no --commitlint --edit "\$\1"'

# Clean up / implode
rm README.md
mv README_TEMPLATE.md README.md
mv github .github
rm customize.sh
rm data.json
