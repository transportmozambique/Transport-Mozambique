import re

file_path = "transport-client/app/api/ussd/route.ts"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix Option 5 Level 3
content = re.sub(
    r"const origin = locations\[parseInt\(secondChoice\) - 1\];",
    r"const origin = locations[pages[1] * 6 + parseInt(secondChoice) - 1];",
    content
)

# Replace the destIndex calculation if it's not already using pages
content = re.sub(
    r"const destination = destinations\[parseInt\(thirdInput\) - 1\];",
    r"const destination = destinations[pages[2] * 6 + parseInt(thirdInput) - 1];",
    content
)

# Fix Option 2 Level 3 (Search routes)
content = re.sub(
    r"const locationIndex = parseInt\(secondChoice\) - 1;",
    r"const locationIndex = pages[1] * 6 + parseInt(secondChoice) - 1;",
    content
)

content = re.sub(
    r"const routeIndex = parseInt\(thirdInput\) - 1;",
    r"const routeIndex = pages[2] * 6 + parseInt(thirdInput) - 1;",
    content
)

# Fix Option 3 Level 3 (Search stops)
content = re.sub(
    r"const areaIndex = parseInt\(secondChoice\) - 1;",
    r"const areaIndex = pages[1] * 6 + parseInt(secondChoice) - 1;",
    content
)

content = re.sub(
    r"const stopIndex = parseInt\(thirdInput\) - 1;",
    r"const stopIndex = pages[2] * 6 + parseInt(thirdInput) - 1;",
    content
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Indexes updated!")
