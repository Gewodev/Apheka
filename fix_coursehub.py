import re

with open(r'C:\Users\USER\tauri-app\src\components\CourseHub.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and remove the duplicate Notes section (lines 906-971)
# The pattern is: after the conditional ends at line 904, there's another Notes section
# We need to remove lines 906-971 and line 987

# Split into lines
lines = content.split('\n')

# Find the start of the duplicate Notes section (line 906, 0-indexed: 905)
# It's the block starting with {!recordarNote && !recordarShowResult && (
# after the conditional closes

# Find the lines to remove
# The second Notes section starts after line 904
# And ends before the History section at line 973

# Let's identify by content
start_remove = None
end_remove = None

for i, line in enumerate(lines):
    # Start of duplicate Notes section (after line 904)
    if i > 904 and '{!recordarNote && !recordarShowResult && (' in line and start_remove is None:
        # Check if this is the second occurrence (after the conditional ends)
        start_remove = i
    # End of duplicate Notes section (before History)
    if i > 905 and '{/* History */}' in line and start_remove is not None:
        end_remove = i
        break

if start_remove and end_remove:
    print(f"Removing lines {start_remove+1} to {end_remove-1}")
    new_lines = lines[:start_remove] + lines[end_remove:]
else:
    print("Could not find duplicate section")
    new_lines = lines

# Now check for extra closing div (around line 987)
# Look for </div> after History section that shouldn't be there
final_lines = []
skip_next_div = False

for i, line in enumerate(new_lines):
    # After History section closes (</div>} at end of History)
    # Check if there's an extra </div> that should be removed
    stripped = line.strip()
    if '{/* History */}' in line:
        # Mark that we're in History section
        skip_next_div = True
    if skip_next_div and stripped == '</div>':
        # Skip this extra closing div
        skip_next_div = False
        continue
    final_lines.append(line)

with open(r'C:\Users\USER\tauri-app\src\components\CourseHub.tsx', 'w', encoding='utf-8') as f:
    f.write('\n'.join(final_lines))

print("Done")
