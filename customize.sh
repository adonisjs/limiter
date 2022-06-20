ignore_files=".git|node_modules|_templates|customize.sh|README.md|.png"

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
npx husky add .husky/commit-msg 'npx --no --commitlint --edit "\$1"'

# Clean up / implode
rm README.md
mv README_TEMPLATE.md README.md
mv github .github
rm customize.sh
rm data.json

# Testing ts-node loader hook
echo ""
echo "${YELLOW}======================================================"
echo "${YELLOW}Testing ts-node esm loader hook"
node --loader=ts-node/esm "index.ts"
[ $? -eq 0 ] && echo "${GREEN}Loader worked as expected" || echo "${RED}Loader command failed"

# Testing tsc build
echo ""
echo "${YELLOW}======================================================"
echo "${YELLOW}Testing typescript build"
npm run build
[ $? -eq 0 ] && echo "${GREEN}tsc worked as expected" || echo "${RED}tsc command failed"

# Testing tsc build output
echo ""
echo "${YELLOW}======================================================"
echo "${YELLOW}Testing typescript output"
node build/index.js
[ $? -eq 0 ] && echo "${GREEN}compiled output is valid" || echo "${RED}compiled output is invalid"

# Final notice
echo ""
echo "${YELLOW}======================================================"
echo "${YELLOW}Please remove ejs dependency from this project"
echo "${YELLOW}======================================================"
