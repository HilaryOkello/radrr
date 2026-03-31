#!/usr/bin/env python3
"""Generate favicon.ico from SVG logo"""
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw
import io

# Parse the SVG
svg_content = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <circle cx="4" cy="28" r="3.2" fill="#4a148c"/>
  <path d="M4 20 A8 8 0 0 1 12 28" stroke="#6a1b9a" stroke-width="3.8" stroke-linecap="round" fill="none"/>
  <path d="M4 12.8 A15.2 15.2 0 0 1 19.2 28" stroke="#8e24aa" stroke-width="3.8" stroke-linecap="round" fill="none"/>
  <path d="M4 5.6 A22.4 22.4 0 0 1 26.4 28" stroke="#43a047" stroke-width="3.8" stroke-linecap="round" fill="none"/>
</svg>'''

# Create multiple sizes for the favicon
sizes = [16, 32, 48]
images = []

for size in sizes:
    # Create a new image with white background
    img = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    
    # Scale factor
    scale = size / 32
    
    # Draw the logo elements (simplified version)
    # Circle
    circle_x = int(4 * scale)
    circle_y = int(28 * scale)
    circle_r = int(3.2 * scale)
    draw.ellipse([circle_x - circle_r, circle_y - circle_r, 
                  circle_x + circle_r, circle_y + circle_r], 
                 fill=(74, 20, 140, 255))
    
    # Arc 1
    draw.arc([int(4 * scale) - int(8 * scale), int(20 * scale) - int(8 * scale),
              int(12 * scale) + int(8 * scale), int(28 * scale) + int(8 * scale)],
             start=0, end=90, fill=(106, 27, 154, 255), width=int(3.8 * scale))
    
    # Arc 2
    draw.arc([int(4 * scale) - int(15.2 * scale), int(12.8 * scale) - int(15.2 * scale),
              int(19.2 * scale) + int(15.2 * scale), int(28 * scale) + int(15.2 * scale)],
             start=0, end=90, fill=(142, 36, 170, 255), width=int(3.8 * scale))
    
    # Arc 3
    draw.arc([int(4 * scale) - int(22.4 * scale), int(5.6 * scale) - int(22.4 * scale),
              int(26.4 * scale) + int(22.4 * scale), int(28 * scale) + int(22.4 * scale)],
             start=0, end=90, fill=(67, 160, 71, 255), width=int(3.8 * scale))
    
    images.append(img)

# Save as ICO
images[0].save('app/favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48)], 
               append_images=images[1:])
print("Favicon created successfully!")
