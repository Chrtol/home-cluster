#!/usr/bin/env python3
"""
Script to add source_name and source_url to existing seed_schedules.py templates
"""

import re

# Read the file
with open('app/seed_schedules.py', 'r') as f:
    content = f.read()

# Define source mappings based on template name prefix
source_mappings = {
    'ReptiFiles': {
        'name': 'ReptiFiles',
        'default_url': 'https://reptifiles.com/',
        'specific_urls': {
            'Bearded Dragon': 'https://reptifiles.com/bearded-dragon-care/',
            'Leopard Gecko': 'https://reptifiles.com/leopard-gecko-care/',
            'Crested Gecko': 'https://reptifiles.com/crested-gecko-care/',
            'Ball Python': 'https://reptifiles.com/ball-python-care/',
            'Corn Snake': 'https://reptifiles.com/corn-snake-care/',
            'Blue Tongue Skink': 'https://reptifiles.com/blue-tongue-skink-care/',
        }
    },
    'The Bio Dude': {
        'name': 'The Bio Dude',
        'default_url': 'https://www.thebiodude.com/blogs/reptile-care-guides',
    },
    'Reptile Magazine': {
        'name': 'Reptile Magazine',
        'default_url': 'https://reptilemag.com/',
    },
    'Tropical Species': {
        'name': None,  # No source for general misting
        'default_url': None,
    },
}

# Pattern to find ScheduleTemplate definitions
# This is a simplified approach - we'll add source info before is_default=True

lines = content.split('\n')
new_lines = []
i = 0

while i < len(lines):
    line = lines[i]
    new_lines.append(line)

    # Check if this is a line with is_default=True and we haven't added source yet
    if 'is_default=True' in line and 'source_name' not in lines[max(0, i-5):i]:
        # Look back to find the template name
        template_name = None
        species = None
        for j in range(i-1, max(0, i-40), -1):
            if 'name="' in lines[j]:
                match = re.search(r'name="([^"]+)"', lines[j])
                if match:
                    template_name = match.group(1)
            if 'species="' in lines[j]:
                match = re.search(r'species="([^"]+)"', lines[j])
                if match:
                    species = match.group(1)
            if template_name and (species or 'General' in template_name or 'Weighing' in template_name):
                break

        # Determine source based on template name
        source_name = None
        source_url = None

        if template_name:
            if template_name.startswith('ReptiFiles'):
                source_name = 'ReptiFiles'
                if species and species in source_mappings['ReptiFiles']['specific_urls']:
                    source_url = source_mappings['ReptiFiles']['specific_urls'][species]
                else:
                    source_url = source_mappings['ReptiFiles']['default_url']
            elif template_name.startswith('The Bio Dude'):
                source_name = 'The Bio Dude'
                source_url = source_mappings['The Bio Dude']['default_url']
            elif template_name.startswith('Reptile Magazine'):
                source_name = 'Reptile Magazine'
                source_url = source_mappings['Reptile Magazine']['default_url']

        # Insert source lines before is_default
        if source_name and source_url:
            indent = ' ' * (len(line) - len(line.lstrip()))
            source_lines = [
                f'{indent}source_name="{source_name}",',
                f'{indent}source_url="{source_url}",',
            ]
            # Insert before the current line
            new_lines.pop()  # Remove is_default line we just added
            new_lines.extend(source_lines)
            new_lines.append(line)  # Re-add is_default line

    i += 1

# Write the modified content
with open('app/seed_schedules.py', 'w') as f:
    f.write('\n'.join(new_lines))

print("Source URLs added to seed_schedules.py!")
