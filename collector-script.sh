#!/bin/bash

# Output file
OUTPUT_FILE="mfe_codebase.txt"

# Array of file paths to collect
declare -a FILES=(
    "bin/seans-mfe-tool.js"
    "src/commands/create-api.js"
    "src/commands/create-remote.js"
    "src/commands/create-shell.js"
    "src/commands/deploy.js"
    "src/commands/build.js"
    "src/utils/DatabaseGenerator/DatabaseGenerator.js"
    "src/utils/ControllerGenerator/ControllerGenerator.js"
    "src/utils/RouteGenerator/RouteGenerator.js"
    "src/utils/generators/NameGenerator.js"
    "src/utils/generators/ResourceMapper.js"
    "src/templates/react/remote/rspack.config.js"
    "src/templates/react/shell/rspack.config.js"
    "src/templates/react/remote/src/App.jsx"
    "src/templates/react/shell/src/App.jsx"
    "docs/api-generator-readme.md"
    "docs/benefit-analysis.md"
    "docs/phased-benefit-analysis.md"
    "docs/mid-term-phase-approach.md"
    "examples/bizcase-api/src/index.js"
    "examples/my-remote/src/app.jsx"
    "examples/my-shell/src/App.jsx"
    "ideApp/editor/src/EditorPanel.jsx"
    "examples/cost-benefit-api.yaml"
)

# Clear or create output file
echo "<documents>" > "$OUTPUT_FILE"

# Function to process each file
process_file() {
    local file=$1
    if [ -f "$file" ]; then
        echo "Processing: $file"
        echo -e "<document>" >> "$OUTPUT_FILE"
        echo -e "<source>$file</source>" >> "$OUTPUT_FILE"
        echo -e "<document_content>" >> "$OUTPUT_FILE"
        cat "$file" >> "$OUTPUT_FILE"
        echo -e "</document_content>" >> "$OUTPUT_FILE"
        echo -e "</document>" >> "$OUTPUT_FILE"
        echo -e "\n" >> "$OUTPUT_FILE"
    else
        echo "Warning: File not found - $file"
    fi
}

# Process each file in the array
for file in "${FILES[@]}"
do
    process_file "$file"
done

# Close documents tag
echo "</documents>" >> "$OUTPUT_FILE"

echo "Code collection complete! Output saved to $OUTPUT_FILE"
echo "Total files processed: ${#FILES[@]}"
