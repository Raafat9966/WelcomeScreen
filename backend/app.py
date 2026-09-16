import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-me')
ALGORITHM = 'HS256'
TOKEN_TTL_MINUTES = 60
TEST_USER = 'testuser'
TEST_PASSWORD = 'testpass'

app = FastAPI(title='Auth Demo API')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:5173', 'http://127.0.0.1:5173'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


class LoginRequest(BaseModel):
    username: str
    password: str


def create_token(username: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        'sub': username,
        'iat': now,
        'exp': now + timedelta(minutes=TOKEN_TTL_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(request: Request):
    token = request.cookies.get('session_token')
    if not token:
        raise HTTPException(status_code=401, detail='Not authenticated')

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail='Invalid or expired session') from exc

    username = payload.get('sub')
    if username != TEST_USER:
        raise HTTPException(status_code=401, detail='User is not allowed')

    return {'username': username}


@app.get('/api/health')
async def health_check():
    return {'status': 'ok'}


@app.post('/api/login')
async def login(payload: LoginRequest, response: Response):
    if payload.username != TEST_USER or payload.password != TEST_PASSWORD:
        raise HTTPException(status_code=401, detail='Invalid username or password')

    token = create_token(payload.username)
    response.set_cookie(
        key='session_token',
        value=token,
        httponly=True,
        samesite='lax',
        secure=False,
        max_age=TOKEN_TTL_MINUTES * 60,
    )
    return {'message': 'Login successful', 'user': {'username': payload.username}}


@app.get('/api/me')
async def get_me(request: Request):
    try:
        user = get_current_user(request)
    except HTTPException as exc:
        if exc.status_code == 401:
            return {'user': None}
        raise
    return {'user': user}


@app.post('/api/logout')
async def logout(response: Response):
    response.delete_cookie(key='session_token', path='/')
    return {'message': 'Logged out successfully'}
