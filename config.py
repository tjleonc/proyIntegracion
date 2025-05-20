class DevelopmentConfig:
    DEBUG = True
    MYSQL_HOST = 'localhost'
    MYSQL_USER = 'root'
    MYSQL_PASSWORD = ''
    MYSQL_DB = 'sucursalesapi'
    MYSQL_CURSORCLASS = 'DictCursor'
    MYSQL_UNIX_SOCKET = 'C:/xampp/mysql/mysql.sock'  # ¡Ruta crítica en XAMPP!
    MYSQL_CURSORCLASS = 'DictCursor'

config = {
    'development': DevelopmentConfig
}