import requests

class ChessComAPI:
    BASE_URL = "https://api.chess.com/pub"

    @staticmethod
    def get_player_profile(username):
        url = f"{ChessComAPI.BASE_URL}/player/{username}"
        response = requests.get(url)
        if response.status_code == 200:
            return response.json()
        else:
            return None

    @staticmethod
    def get_player_stats(username):
        url = f"{ChessComAPI.BASE_URL}/player/{username}/stats"
        response = requests.get(url)
        if response.status_code == 200:
            return response.json()
        else:
            return None

    @staticmethod
    def get_player_games(username, year, month):
        url = f"{ChessComAPI.BASE_URL}/player/{username}/games/{year}/{month}"
        response = requests.get(url)
        if response.status_code == 200:
            return response.json()
        else:
            return None