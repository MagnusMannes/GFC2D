from flask import Flask, render_template
from flask_socketio import SocketIO, emit
import json
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key'
socketio = SocketIO(app)

# File paths for data persistence
BOXES_FILE = 'boxes.json'
AREAS_FILE = 'areas.json'

# Helper functions to read and write JSON files
def load_data(filepath, default):
    if os.path.exists(filepath):
        with open(filepath, 'r') as file:
            return json.load(file)
    return default

def save_data(filepath, data):
    with open(filepath, 'w') as file:
        json.dump(data, file, indent=4)

# Load initial data
areas = load_data(AREAS_FILE, [])
boxes = load_data(BOXES_FILE, [])

# Ensure all boxes have a 'locked' property
def ensure_locked_property():
    for box in boxes:
        if 'locked' not in box:
            box['locked'] = False  # Default to unlocked
    save_data(BOXES_FILE, boxes)  # Save updated boxes

ensure_locked_property()

@app.route('/')
def index():
    return render_template('index.html')

# Emit current state on client connection
@socketio.on('connect')
def handle_connect():
    emit('update_areas', areas)
    emit('update_boxes', boxes)

# Socket events for areas
@socketio.on('create_area')
def handle_create_area(data):
    areas.append(data)
    save_data(AREAS_FILE, areas)  # Save areas to the file
    emit('update_areas', areas, broadcast=True)

@socketio.on('update_area')
def handle_update_area(data):
    for area in areas:
        if area['name'] == data['name']:
            area.update(data)
    save_data(AREAS_FILE, areas)  # Save areas to the file
    emit('update_areas', areas, broadcast=True)

@socketio.on('delete_area')
def handle_delete_area(data):
    global areas
    areas = [area for area in areas if area['name'] != data['name']]
    save_data(AREAS_FILE, areas)  # Save areas to the file
    emit('update_areas', areas, broadcast=True)

@socketio.on('update_box_rotation')
def handle_update_box_rotation(data):
    for box in boxes:
        if box['name'] == data['name']:
            box['rotation'] = data['rotation']
    save_data(BOXES_FILE, boxes)  # Save boxes to the file
    emit('update_boxes', boxes, broadcast=True)

# Socket events for boxes
@socketio.on('create_box')
def handle_create_box(data):
    # Add default locked state
    data['locked'] = False  # Newly created boxes are unlocked by default
    boxes.append(data)
    save_data(BOXES_FILE, boxes)  # Save boxes to the file
    emit('update_boxes', boxes, broadcast=True)

@socketio.on('update_box_position')
def handle_update_box_position(data):
    for box in boxes:
        if box['name'] == data['name']:
            box['x'] = data['x']
            box['y'] = data['y']
    save_data(BOXES_FILE, boxes)  # Save boxes to the file
    emit('update_boxes', boxes, broadcast=True)

@socketio.on('update_box_comment')
def handle_update_box_comment(data):
    for box in boxes:
        if box['name'] == data['name']:
            box['comment'] = data['comment']
    save_data(BOXES_FILE, boxes)  # Save boxes to the file
    emit('update_boxes', boxes, broadcast=True)

@socketio.on('delete_box')
def handle_delete_box(data):
    global boxes
    boxes = [box for box in boxes if box['name'] != data['name']]
    save_data(BOXES_FILE, boxes)  # Save boxes to the file
    emit('update_boxes', boxes, broadcast=True)

@socketio.on('update_box_lock')
def handle_update_box_lock(data):
    box_name = data['name']
    locked = data['locked']
    for box in boxes:
        if box['name'] == box_name:
            box['locked'] = locked  # Update the locked state
            save_data(BOXES_FILE, boxes)  # Save updated boxes
            break
    emit('update_boxes', boxes, broadcast=True)  # Notify all clients

if __name__ == '__main__':
    socketio.run(app, debug=True)
