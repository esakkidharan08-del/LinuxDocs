import json
from pathlib import Path

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required


commands_bp = Blueprint('commands', __name__)
DATA_PATH = Path(__file__).resolve().parent.parent / 'data' / 'commands.json'


def load_data():
    with DATA_PATH.open(encoding='utf-8') as data_file:
        return json.load(data_file)


@commands_bp.get('/commands')
@jwt_required()
def list_commands():
    data = load_data()
    return jsonify({'categories': data['categories'], 'domains': data['domains'], 'commands': data['commands']}), 200


@commands_bp.get('/commands/<string:slug>')
@jwt_required()
def get_command(slug):
    command = next((item for item in load_data()['commands'] if item['slug'].lower() == slug.lower()), None)
    if command is None:
        return jsonify({'error': 'Command not found'}), 404
    return jsonify({'command': command}), 200
