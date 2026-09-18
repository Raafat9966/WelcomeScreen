import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
import motor.motor_asyncio
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from passlib.context import CryptContext
from bson.objectid import ObjectId

from dotenv import load_dotenv

# load environment variables from .env (optional; requires python-dotenv)
load_dotenv()

SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-me')
ALGORITHM = 'HS256'
TOKEN_TTL_MINUTES = 60
MONGO_URI = os.getenv('MONGO_URI')
MONGO_DB = os.getenv('MONGO_DB')


app = FastAPI(title='Auth Demo API')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:5173', 'http://127.0.0.1:5173'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# Mongo client and database will be set on startup
mongo_client: Optional[motor.motor_asyncio.AsyncIOMotorClient] = None
db = None


class SignupRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


def create_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=TOKEN_TTL_MINUTES)
    payload = {
        'sub': user_id,
        'iat': int(now.timestamp()),
        'exp': int(exp.timestamp()),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(request: Request):
    token = request.cookies.get('session_token')
    if not token:
        raise HTTPException(status_code=401, detail='Not authenticated')

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail='Invalid or expired session') from exc

    user_id = payload.get('sub')
    if not user_id:
        raise HTTPException(status_code=401, detail='Invalid token payload')

    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=401, detail='Invalid user id in token')

    user = await db['users'].find_one({'_id': oid})
    if not user:
        raise HTTPException(status_code=401, detail='User not found')

    return {'id': str(user.get('_id')), 'name': user.get('name'), 'email': user.get('email')}


@app.on_event('startup')
async def startup_event():
    global mongo_client, db
    mongo_client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
    db = mongo_client[MONGO_DB]
    # ensure unique index on email
    await db['users'].create_index('email', unique=True)


@app.on_event('shutdown')
async def shutdown_event():
    global mongo_client
    if mongo_client:
        mongo_client.close()


@app.get('/api/health')
async def health_check():
    return {'status': 'ok'}


@app.post('/api/signup')
async def signup(payload: SignupRequest):
    if not payload.name.strip() or not payload.email.strip() or not payload.password:
        raise HTTPException(status_code=400, detail='name, email and password required')

    email = payload.email.strip().lower()
    existing = await db['users'].find_one({'email': email})
    if existing:
        raise HTTPException(status_code=400, detail='email already registered')

    # hash the password; prefer bcrypt_sha256 to avoid bcrypt 72-byte limit
    try:
        password_hash = pwd_context.hash(payload.password)
    except ValueError as ve:
        # common bcrypt length error
        if 'longer than 72 bytes' in str(ve):
            raise HTTPException(status_code=400, detail='Password too long (bcrypt limit 72 bytes). Choose a shorter password.')
        raise HTTPException(status_code=500, detail='Hashing error')
    except Exception:
        raise HTTPException(status_code=500, detail='Hashing error')

    doc = {
        'name': payload.name.strip(),
        'email': email,
        'password': password_hash,
        'created_at': datetime.now(timezone.utc),
    }
    result = await db['users'].insert_one(doc)
    return {
        'message': 'User created',
        'user': {'id': str(result.inserted_id), 'name': doc['name'], 'email': doc['email']},
    }


@app.post('/api/login')
async def login(payload: LoginRequest, response: Response):
    user = await db['users'].find_one({'email': payload.email.strip().lower()})
    if not user:
        raise HTTPException(status_code=401, detail='Invalid email or password')

    if not pwd_context.verify(payload.password, user.get('password', '')):
        raise HTTPException(status_code=401, detail='Invalid email or password')

    token = create_token(str(user['_id']))
    response.set_cookie(
        key='session_token',
        value=token,
        httponly=True,
        samesite='lax',
        secure=False,
        max_age=TOKEN_TTL_MINUTES * 60,
        path='/',
    )
    return {
        'message': 'Login successful',
        'user': {'id': str(user['_id']), 'name': user.get('name'), 'email': user.get('email')},
    }


@app.get('/api/me')
async def get_me(request: Request):
    try:
        user = await get_current_user(request)
    except HTTPException as exc:
        if exc.status_code == 401:
            return {'user': None}
        raise
    return {'user': user}


@app.post('/api/logout')
async def logout(response: Response):
    response.delete_cookie(key='session_token', path='/')
    return {'message': 'Logged out successfully'}
