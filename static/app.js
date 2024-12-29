// Corrected drag and drop issue - Refined to ensure precise placement
const socket = io();
const canvasContainer = document.getElementById('canvasContainer');
const settingsModal = document.getElementById('settingsModal');
const openSettings = document.getElementById('openSettings');
const closeSettings = document.getElementById('closeSettings');
const addAreaButton = document.getElementById('addAreaButton');
const areaList = document.getElementById('areaList');
const boxForm = document.getElementById('boxForm');

// Scaling factor
let metersToPixels = 25;

// Global area positioning
let nextAreaY = 80; // Initial vertical position (below the menu)
const areaSpacingY = 40; // Increased space between areas

let areas = []; // Global list of areas to track and modify
let lockedBoxes = {}; // Track locked boxes

// Scroll settings
const scrollThreshold = 50; // Distance from edges to trigger scrolling
const scrollSpeed = 10; // Speed of scrolling
let scrollInterval = null; // Interval to handle scrolling

let dragOffsetX = 0;
let dragOffsetY = 0;

// Open settings modal
openSettings.addEventListener('click', () => {
    settingsModal.classList.add('active');
});

// Close settings modal
closeSettings.addEventListener('click', () => {
    settingsModal.classList.remove('active');
});

// Add a new area
addAreaButton.addEventListener('click', () => {
    const areaName = prompt("Enter area name:");
    if (!areaName) return;

    const newArea = {
        name: areaName,
        width: 800,
        height: 600,
        x: 10, // Fixed horizontal position
        y: nextAreaY, // Positioned below the previous area
    };

    // Emit the create_area event to the server
    socket.emit('create_area', newArea);
});

// Adjust all areas' positions dynamically
const adjustAreaPositions = () => {
    let currentY = 80; // Start below the menu
    areas.forEach((area) => {
        area.y = currentY;
        currentY += area.height + areaSpacingY;
    });
};

// Enable scrolling when dragging near edges
const enableScrollOnDrag = (event) => {
    const rect = canvasContainer.getBoundingClientRect();

    // Stop any existing scrolling
    clearInterval(scrollInterval);

    // Check if dragging near the top or bottom edges
    if (event.clientY - rect.top < scrollThreshold) {
        scrollInterval = setInterval(() => {
            canvasContainer.scrollTop -= scrollSpeed;
        }, 50);
    } else if (rect.bottom - event.clientY < scrollThreshold) {
        scrollInterval = setInterval(() => {
            canvasContainer.scrollTop += scrollSpeed;
        }, 50);
    } else {
        clearInterval(scrollInterval);
    }
};

// Clear scrolling when drag ends
const clearScrollOnDragEnd = () => {
    clearInterval(scrollInterval);
};

// Render areas dynamically
const renderAreas = () => {
    adjustAreaPositions(); // Adjust positions dynamically
    canvasContainer.innerHTML = ''; // Clear canvas

    areas.forEach((area, index) => {
        // Create the area label (name displayed above the area)
        const areaLabel = document.createElement('div');
        areaLabel.classList.add('area-label');
        areaLabel.textContent = area.name;
        areaLabel.style.position = 'absolute';
        areaLabel.style.left = `${area.x}px`;
        areaLabel.style.top = `${area.y - 30}px`; // Position above the area
        areaLabel.style.fontWeight = 'bold';
        areaLabel.style.fontSize = '20px'; // Increased font size for labels

        // Create the area itself
        const areaDiv = document.createElement('div');
        areaDiv.classList.add('area');
        areaDiv.style.position = 'absolute';
        areaDiv.style.width = `${area.width}px`;
        areaDiv.style.height = `${area.height}px`;
        areaDiv.style.left = `${area.x}px`;
        areaDiv.style.top = `${area.y}px`;

        // Append area label and area div to the canvas
        canvasContainer.appendChild(areaLabel);
        canvasContainer.appendChild(areaDiv);
    });

    // Update settings modal with areas
    areaList.innerHTML = '';
    areas.forEach((area, index) => {
        const areaItem = document.createElement('div');
        areaItem.classList.add('area-item');
        areaItem.textContent = `${area.name} (${area.width / metersToPixels}m x ${area.height / metersToPixels}m)`;

        const modifyButton = document.createElement('button');
        modifyButton.textContent = 'Modify';
        modifyButton.addEventListener('click', () => {
            const newWidth = prompt('Enter new width (meters):', area.width / metersToPixels);
            const newHeight = prompt('Enter new height (meters):', area.height / metersToPixels);
            if (newWidth && newHeight) {
                const updatedArea = {
                    name: area.name,
                    width: Math.round(parseFloat(newWidth) * metersToPixels),
                    height: Math.round(parseFloat(newHeight) * metersToPixels)
                };
                socket.emit('update_area', updatedArea);
            }
        });

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => {
            if (confirm(`Are you sure you want to delete the area "${area.name}"?`)) {
                socket.emit('delete_area', { name: area.name });
            }
        });

        areaItem.appendChild(modifyButton);
        areaItem.appendChild(deleteButton);
        areaList.appendChild(areaItem);
    });
};

// Handle area updates from the server
socket.on('update_areas', (serverAreas) => {
    areas = serverAreas; // Update the local areas list
    renderAreas(); // Re-render areas on the canvas
});



let currentColor = '#add8e6'; // Default color

// Get the color input element
const colorInput = document.getElementById('color');

// Update the currentColor whenever the user selects a new color
colorInput.addEventListener('input', (event) => {
    currentColor = event.target.value;
});

// Add a box
boxForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = document.getElementById('name').value;
    const width = Math.round(parseFloat(document.getElementById('width').value) * metersToPixels);
    const height = Math.round(parseFloat(document.getElementById('height').value) * metersToPixels);
    const isCircle = document.getElementById('isCircle').checked;

    const box = {
        name,
        width,
        height,
        x: 10,
        y: 10,
        color: currentColor, // Use the remembered color
        isCircle,
        locked: false, // Default to unlocked
        comment: " ", // Optional comment
        rotation: 0 // Default rotation
    };

    socket.emit('create_box', box);

    // Reset the form, but restore the selected color
    boxForm.reset();
    colorInput.value = currentColor; // Restore the remembered color to the input field
});



// Render boxes dynamically
let activeTooltip = null; // Track the currently active tooltip

socket.on('update_boxes', (boxes) => {
    canvasContainer.querySelectorAll('.box').forEach((box) => box.remove());

    boxes.forEach((box) => {
        const div = document.createElement('div');
        div.classList.add('box');
        div.style.position = 'absolute';
        div.style.width = `${Math.round(box.width)}px`;
        div.style.height = `${Math.round(box.height)}px`;
        div.style.left = `${box.x}px`;
        div.style.top = `${box.y}px`;
        div.style.backgroundColor = box.color || 'blue';
        div.style.border = box.locked ? '2px solid red' : '2px solid black';
        div.style.borderRadius = box.isCircle ? '50%' : '0';
        div.textContent = box.name;
        div.setAttribute('draggable', !box.locked);
        div.style.cursor = box.locked ? 'not-allowed' : 'grab';
        div.style.transform = `rotate(${box.rotation || 0}deg)`;

        // Tooltip for box details
        const tooltip = document.createElement('div');
        tooltip.classList.add('tooltip');
        tooltip.style.position = 'absolute';
        tooltip.style.backgroundColor = 'black';
        tooltip.style.color = 'white';
        tooltip.style.padding = '5px';
        tooltip.style.borderRadius = '3px';
        tooltip.style.visibility = 'hidden';
        tooltip.style.opacity = '0';
        tooltip.style.transition = 'visibility 0s, opacity 0.2s';
        tooltip.style.zIndex = '10000';

        // Calculate dimensions and area
        const widthMeters = box.width / metersToPixels;
        const heightMeters = box.height / metersToPixels;
        const area = widthMeters * heightMeters;

        // Populate tooltip content
        tooltip.textContent = `
            Comment: ${box.comment || 'None'}
            Width: ${widthMeters.toFixed(2)}m
            Height: ${heightMeters.toFixed(2)}m
            Area: ${area.toFixed(2)}m²
        `;

        div.addEventListener('mouseenter', (event) => {
            if (activeTooltip) {
                activeTooltip.style.visibility = 'hidden';
                activeTooltip.style.opacity = '0';
                if (document.body.contains(activeTooltip)) {
                    document.body.removeChild(activeTooltip);
                }
            }
            activeTooltip = tooltip;
            tooltip.style.visibility = 'visible';
            tooltip.style.opacity = '1';
            tooltip.style.left = `${event.pageX + 10}px`;
            tooltip.style.top = `${event.pageY + 10}px`;
            document.body.appendChild(tooltip);
        });

        div.addEventListener('mousemove', (event) => {
            tooltip.style.left = `${event.pageX + 10}px`;
            tooltip.style.top = `${event.pageY + 10}px`;
        });

        div.addEventListener('mouseleave', () => {
            if (tooltip === activeTooltip) {
                tooltip.style.visibility = 'hidden';
                tooltip.style.opacity = '0';
                if (document.body.contains(tooltip)) {
                    document.body.removeChild(tooltip);
                }
                activeTooltip = null;
            }
        });

        // Drag events remain unchanged
        div.addEventListener('dragstart', (event) => {
            if (lockedBoxes[box.name]) return;

            const rect = div.getBoundingClientRect();
            dragOffsetX = event.clientX - rect.left;
            dragOffsetY = event.clientY - rect.top;

            event.dataTransfer.setData('text/plain', JSON.stringify(box));
            event.dataTransfer.effectAllowed = 'move';
        });

        div.addEventListener('dragend', (event) => {
            if (lockedBoxes[box.name]) return;

            const canvasRect = canvasContainer.getBoundingClientRect();
            const dropX = event.clientX - canvasRect.left - dragOffsetX + canvasContainer.scrollLeft;
            const dropY = event.clientY - canvasRect.top - dragOffsetY + canvasContainer.scrollTop;

            // Adjust to account for canvas boundaries
            const adjustedX = Math.max(0, Math.min(canvasContainer.scrollWidth - box.width, dropX));
            const adjustedY = Math.max(0, Math.min(canvasContainer.scrollHeight - box.height, dropY));

            socket.emit('update_box_position', {
                name: box.name,
                x: adjustedX,
                y: adjustedY,
            });

            clearScrollOnDragEnd();
        });

        canvasContainer.appendChild(div);

        // Context menu
        div.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        
            const menu = document.createElement('div');
            menu.style.position = 'absolute';
            menu.style.left = `${event.pageX}px`;
            menu.style.top = `${event.pageY}px`;
            menu.style.backgroundColor = 'white';
            menu.style.border = '1px solid black';
            menu.style.padding = '5px';
            menu.style.zIndex = '1000';
        
            const lockOption = document.createElement('div');
            lockOption.textContent = box.locked ? 'Unlock' : 'Lock';
            lockOption.style.padding = '5px';
            lockOption.addEventListener('click', () => {
                box.locked = !box.locked;
                div.style.border = box.locked ? '2px solid red' : '2px solid black';
                socket.emit('update_box_lock', { name: box.name, locked: box.locked });
                document.body.removeChild(menu);
            });
            menu.appendChild(lockOption);
        
            const deleteOption = document.createElement('div');
            deleteOption.textContent = 'Delete';
            deleteOption.style.padding = '5px';
            deleteOption.addEventListener('click', () => {
                socket.emit('delete_box', { name: box.name });
                document.body.removeChild(menu);
            });
            menu.appendChild(deleteOption);
        
            const rotateOption = document.createElement('div');
            rotateOption.textContent = 'Rotate';
            rotateOption.style.padding = '5px';
            rotateOption.addEventListener('click', () => {
                const degrees = parseInt(prompt('Enter rotation in degrees:', box.rotation || 0));
                if (!isNaN(degrees)) {
                    socket.emit('update_box_rotation', { name: box.name, rotation: degrees });
                }
                document.body.removeChild(menu);
            });
            menu.appendChild(rotateOption);
        
            const commentOption = document.createElement('div');
            commentOption.textContent = 'Add Comment';
            commentOption.style.padding = '5px';
            commentOption.addEventListener('click', () => {
                const comment = prompt('Enter a comment:', box.comment || '');
                socket.emit('update_box_comment', { name: box.name, comment });
                document.body.removeChild(menu);
            });
            menu.appendChild(commentOption);
        
            const duplicateOption = document.createElement('div');
            duplicateOption.textContent = 'Duplicate';
            duplicateOption.style.padding = '5px';
            duplicateOption.addEventListener('click', () => {
                const newName = prompt('Enter name for the duplicate:', `${box.name}_copy`);
                if (newName) {
                    const duplicateBox = { ...box, name: newName, x: box.x + 10, y: box.y + 10 };
                    socket.emit('create_box', duplicateBox);
                }
                document.body.removeChild(menu);
            });
            menu.appendChild(duplicateOption);
        
            // Legge til hover-effekt for menyvalg
            menu.querySelectorAll('div').forEach((menuItem) => {
                menuItem.style.cursor = 'pointer';
                menuItem.addEventListener('mouseenter', () => {
                    menuItem.style.backgroundColor = '#f0f0f0';
                });
                menuItem.addEventListener('mouseleave', () => {
                    menuItem.style.backgroundColor = 'white';
                });
            });
        
            document.body.appendChild(menu);
        
            const closeMenu = () => {
                if (document.body.contains(menu)) {
                    document.body.removeChild(menu);
                    document.removeEventListener('click', closeMenu);
                }
            };
            document.addEventListener('click', closeMenu);
        });
        
        canvasContainer.appendChild(div);
        
        
    });
});

// Ensure rendering reflects the locked state
socket.on('box_lock_updated', (data) => {
    lockedBoxes[data.name] = data.locked;
});

socket.on('update_box_rotation', (data) => {
    const boxDiv = canvasContainer.querySelector(`.box:contains(${data.name})`);
    if (boxDiv) {
        boxDiv.style.transform = `rotate(${box.rotation || 0}deg)`;
    }
});


// Maintain an array of dots
let dots = [];

// Enable measurement mode
let measuring = false;
document.getElementById('toggleMeasure').addEventListener('click', () => {
    measuring = !measuring;
    if (measuring) {
        alert('Measurement mode enabled. Click to place dots. Click button again to disable');
    } else {
        alert('Measurement mode disabled.');
        dots = []; // Clear dots when exiting measurement mode
        renderDots();
    }
});

// Add a dot and calculate distance
canvasContainer.addEventListener('click', (event) => {
    if (!measuring) return;

    const rect = canvasContainer.getBoundingClientRect();
    const x = event.clientX - rect.left + canvasContainer.scrollLeft;
    const y = event.clientY - rect.top + canvasContainer.scrollTop;

    // Add the new dot
    dots.push({ x, y });

    renderDots();
});

// Render dots and lines on the canvas
function renderDots() {
    // Remove existing dots and lines
    canvasContainer.querySelectorAll('.dot').forEach(dot => dot.remove());
    canvasContainer.querySelectorAll('.line').forEach(line => line.remove());
    canvasContainer.querySelectorAll('.distance-label').forEach(label => label.remove());

    // Add each dot
    dots.forEach((dot, index) => {
        const dotDiv = document.createElement('div');
        dotDiv.classList.add('dot');
        dotDiv.style.position = 'absolute';
        dotDiv.style.width = '8px';
        dotDiv.style.height = '8px';
        dotDiv.style.borderRadius = '50%';
        dotDiv.style.backgroundColor = 'black'; // Change dot color to black
        dotDiv.style.left = `${dot.x - 4}px`; // Center dot
        dotDiv.style.top = `${dot.y - 4}px`;
        dotDiv.title = `Dot ${index + 1}`;

        canvasContainer.appendChild(dotDiv);

        // Draw line and label distance if not the first dot
        if (index > 0) {
            const prevDot = dots[index - 1];

            // Draw the line
            const line = document.createElement('div');
            line.classList.add('line');
            line.style.position = 'absolute';
            line.style.backgroundColor = 'black';
            line.style.height = '2px';
            line.style.width = `${Math.sqrt(Math.pow(dot.x - prevDot.x, 2) + Math.pow(dot.y - prevDot.y, 2))}px`;
            line.style.left = `${prevDot.x}px`;
            line.style.top = `${prevDot.y}px`;
            line.style.transformOrigin = '0 0';
            line.style.transform = `rotate(${Math.atan2(dot.y - prevDot.y, dot.x - prevDot.x) * (180 / Math.PI)}deg)`;

            canvasContainer.appendChild(line);

            // Calculate distance
            const distance = Math.sqrt(
                Math.pow(dot.x - prevDot.x, 2) + Math.pow(dot.y - prevDot.y, 2)
            ) / metersToPixels; // Convert pixels to meters

            // Display distance
            const distanceLabel = document.createElement('div');
            distanceLabel.classList.add('distance-label');
            distanceLabel.textContent = `${distance.toFixed(2)}m`;
            distanceLabel.style.position = 'absolute';
            distanceLabel.style.left = `${(dot.x + prevDot.x) / 2}px`;
            distanceLabel.style.top = `${(dot.y + prevDot.y) / 2}px`;
            distanceLabel.style.backgroundColor = 'white';
            distanceLabel.style.padding = '2px 5px';
            distanceLabel.style.border = '1px solid black';
            distanceLabel.style.borderRadius = '3px';

            canvasContainer.appendChild(distanceLabel);
        }
    });
}


document.getElementById('backupFiles').addEventListener('click', () => {
    const files = ['areas.json', 'boxes.json'];
    files.forEach(file => {
        const link = document.createElement('a');
        link.href = `/download/${file}`;
        link.download = file;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
});


