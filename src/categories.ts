/**
 * Libraries that do the same job. Two teammates adding different libraries from the
 * same category is the classic "we built it two different ways" moment.
 *
 * Package keys are `<ecosystem>:<name>` where ecosystem is npm | pypi | go.
 * `soft` categories are commonly mixed on purpose, so they only produce info-level notes.
 */
export type Ecosystem = "npm" | "pypi" | "go";

export interface Lib {
  id: string;
  label: string;
  packages: string[];
}

export interface Category {
  id: string;
  label: { en: string; vi: string };
  soft?: boolean;
  libs: Lib[];
}

const lib = (id: string, label: string, ...packages: string[]): Lib => ({ id, label, packages });

export const CATEGORIES: Category[] = [
  {
    id: "orm",
    label: { en: "ORM / database layer", vi: "ORM / tầng database" },
    libs: [
      lib("prisma", "Prisma", "npm:prisma", "npm:@prisma/client"),
      lib("mongoose", "Mongoose", "npm:mongoose"),
      lib("typeorm", "TypeORM", "npm:typeorm"),
      lib("sequelize", "Sequelize", "npm:sequelize"),
      lib("drizzle", "Drizzle", "npm:drizzle-orm"),
      lib("knex", "Knex", "npm:knex"),
      lib("mikro-orm", "MikroORM", "npm:@mikro-orm/core"),
      lib("objection", "Objection", "npm:objection"),
      lib("sqlalchemy", "SQLAlchemy", "pypi:sqlalchemy", "pypi:flask-sqlalchemy"),
      lib("peewee", "Peewee", "pypi:peewee"),
      lib("tortoise", "Tortoise ORM", "pypi:tortoise-orm"),
      lib("mongoengine", "MongoEngine", "pypi:mongoengine"),
      lib("gorm", "GORM", "go:gorm.io/gorm"),
      lib("ent", "ent", "go:entgo.io/ent"),
    ],
  },
  {
    id: "database",
    label: { en: "Database engine", vi: "Hệ quản trị database" },
    libs: [
      lib("postgres", "PostgreSQL", "npm:pg", "npm:postgres", "pypi:psycopg2", "pypi:psycopg2-binary", "pypi:psycopg", "pypi:asyncpg", "go:github.com/jackc/pgx/v5", "go:github.com/lib/pq"),
      lib("mysql", "MySQL", "npm:mysql", "npm:mysql2", "pypi:pymysql", "pypi:mysqlclient", "go:github.com/go-sql-driver/mysql"),
      lib("sqlite", "SQLite", "npm:sqlite3", "npm:better-sqlite3", "go:github.com/mattn/go-sqlite3"),
      lib("mongodb", "MongoDB", "npm:mongodb", "pypi:pymongo", "pypi:motor", "go:go.mongodb.org/mongo-driver"),
    ],
  },
  {
    id: "baas",
    label: { en: "Backend-as-a-service", vi: "Backend-as-a-service" },
    libs: [
      lib("firebase", "Firebase", "npm:firebase", "npm:firebase-admin", "pypi:firebase-admin"),
      lib("supabase", "Supabase", "npm:@supabase/supabase-js", "pypi:supabase"),
      lib("appwrite", "Appwrite", "npm:appwrite", "npm:node-appwrite", "pypi:appwrite"),
      lib("pocketbase", "PocketBase", "npm:pocketbase", "pypi:pocketbase"),
    ],
  },
  {
    id: "server",
    label: { en: "Backend framework", vi: "Framework backend" },
    libs: [
      lib("express", "Express", "npm:express"),
      lib("fastify", "Fastify", "npm:fastify"),
      lib("koa", "Koa", "npm:koa"),
      lib("nestjs", "NestJS", "npm:@nestjs/core"),
      lib("hono", "Hono", "npm:hono"),
      lib("hapi", "hapi", "npm:@hapi/hapi"),
      lib("flask", "Flask", "pypi:flask"),
      lib("fastapi", "FastAPI", "pypi:fastapi"),
      lib("django", "Django", "pypi:django"),
      lib("gin", "Gin", "go:github.com/gin-gonic/gin"),
      lib("echo", "Echo", "go:github.com/labstack/echo/v4"),
      lib("fiber", "Fiber", "go:github.com/gofiber/fiber/v2"),
      lib("chi", "chi", "go:github.com/go-chi/chi/v5"),
    ],
  },
  {
    id: "ui",
    label: { en: "Frontend framework", vi: "Framework frontend" },
    libs: [
      lib("react", "React", "npm:react"),
      lib("vue", "Vue", "npm:vue"),
      lib("svelte", "Svelte", "npm:svelte"),
      lib("angular", "Angular", "npm:@angular/core"),
      lib("solid", "Solid", "npm:solid-js"),
      lib("preact", "Preact", "npm:preact"),
    ],
  },
  {
    id: "meta",
    label: { en: "Full-stack framework", vi: "Framework full-stack" },
    libs: [
      lib("next", "Next.js", "npm:next"),
      lib("nuxt", "Nuxt", "npm:nuxt"),
      lib("sveltekit", "SvelteKit", "npm:@sveltejs/kit"),
      lib("remix", "Remix", "npm:@remix-run/react", "npm:@remix-run/node"),
      lib("astro", "Astro", "npm:astro"),
      lib("gatsby", "Gatsby", "npm:gatsby"),
    ],
  },
  {
    id: "build",
    label: { en: "Build tool", vi: "Công cụ build" },
    libs: [
      lib("vite", "Vite", "npm:vite"),
      lib("webpack", "webpack", "npm:webpack"),
      lib("cra", "Create React App", "npm:react-scripts"),
      lib("parcel", "Parcel", "npm:parcel"),
    ],
  },
  {
    id: "state",
    label: { en: "State management", vi: "Quản lý state" },
    libs: [
      lib("redux", "Redux", "npm:redux", "npm:@reduxjs/toolkit", "npm:react-redux"),
      lib("zustand", "Zustand", "npm:zustand"),
      lib("mobx", "MobX", "npm:mobx"),
      lib("jotai", "Jotai", "npm:jotai"),
      lib("recoil", "Recoil", "npm:recoil"),
      lib("valtio", "Valtio", "npm:valtio"),
      lib("pinia", "Pinia", "npm:pinia"),
      lib("vuex", "Vuex", "npm:vuex"),
    ],
  },
  {
    id: "fetching",
    label: { en: "Data fetching", vi: "Lấy dữ liệu (data fetching)" },
    libs: [
      lib("react-query", "TanStack Query", "npm:@tanstack/react-query", "npm:react-query"),
      lib("swr", "SWR", "npm:swr"),
      lib("apollo", "Apollo Client", "npm:@apollo/client"),
      lib("urql", "urql", "npm:urql"),
    ],
  },
  {
    id: "http",
    label: { en: "HTTP client", vi: "Thư viện gọi HTTP" },
    libs: [
      lib("axios", "axios", "npm:axios"),
      lib("got", "got", "npm:got"),
      lib("ky", "ky", "npm:ky"),
      lib("superagent", "superagent", "npm:superagent"),
      lib("node-fetch", "node-fetch", "npm:node-fetch"),
      lib("requests", "requests", "pypi:requests"),
      lib("httpx", "httpx", "pypi:httpx"),
      lib("aiohttp", "aiohttp", "pypi:aiohttp"),
    ],
  },
  {
    id: "uikit",
    label: { en: "UI component library", vi: "Thư viện UI component" },
    libs: [
      lib("mui", "MUI", "npm:@mui/material"),
      lib("antd", "Ant Design", "npm:antd"),
      lib("chakra", "Chakra UI", "npm:@chakra-ui/react"),
      lib("mantine", "Mantine", "npm:@mantine/core"),
      lib("react-bootstrap", "React Bootstrap", "npm:react-bootstrap"),
    ],
  },
  {
    id: "styling",
    label: { en: "Styling approach", vi: "Cách viết style" },
    soft: true,
    libs: [
      lib("tailwind", "Tailwind CSS", "npm:tailwindcss"),
      lib("styled-components", "styled-components", "npm:styled-components"),
      lib("emotion", "Emotion", "npm:@emotion/react", "npm:@emotion/styled"),
      lib("bootstrap", "Bootstrap", "npm:bootstrap"),
    ],
  },
  {
    id: "auth",
    label: { en: "Authentication", vi: "Xác thực (auth)" },
    libs: [
      lib("next-auth", "Auth.js / NextAuth", "npm:next-auth", "npm:@auth/core"),
      lib("passport", "Passport", "npm:passport"),
      lib("clerk", "Clerk", "npm:@clerk/nextjs", "npm:@clerk/clerk-react", "npm:@clerk/express"),
      lib("lucia", "Lucia", "npm:lucia"),
      lib("better-auth", "Better Auth", "npm:better-auth"),
      lib("auth0", "Auth0", "npm:@auth0/nextjs-auth0", "npm:@auth0/auth0-react"),
      lib("flask-login", "Flask-Login", "pypi:flask-login"),
    ],
  },
  {
    id: "validation",
    label: { en: "Validation", vi: "Kiểm tra dữ liệu (validation)" },
    libs: [
      lib("zod", "Zod", "npm:zod"),
      lib("yup", "Yup", "npm:yup"),
      lib("joi", "Joi", "npm:joi"),
      lib("valibot", "Valibot", "npm:valibot"),
      lib("superstruct", "Superstruct", "npm:superstruct"),
      lib("pydantic", "Pydantic", "pypi:pydantic"),
      lib("marshmallow", "marshmallow", "pypi:marshmallow"),
    ],
  },
  {
    id: "date",
    label: { en: "Date library", vi: "Thư viện ngày giờ" },
    libs: [
      lib("moment", "Moment", "npm:moment"),
      lib("dayjs", "Day.js", "npm:dayjs"),
      lib("date-fns", "date-fns", "npm:date-fns"),
      lib("luxon", "Luxon", "npm:luxon"),
      lib("arrow", "Arrow", "pypi:arrow"),
      lib("pendulum", "Pendulum", "pypi:pendulum"),
    ],
  },
  {
    id: "test",
    label: { en: "Unit test runner", vi: "Công cụ unit test" },
    libs: [
      lib("jest", "Jest", "npm:jest"),
      lib("vitest", "Vitest", "npm:vitest"),
      lib("mocha", "Mocha", "npm:mocha"),
      lib("ava", "AVA", "npm:ava"),
      lib("jasmine", "Jasmine", "npm:jasmine"),
      lib("pytest", "pytest", "pypi:pytest"),
      lib("nose2", "nose2", "pypi:nose2"),
    ],
  },
  {
    id: "e2e",
    label: { en: "End-to-end testing", vi: "Kiểm thử end-to-end" },
    soft: true,
    libs: [
      lib("playwright", "Playwright", "npm:@playwright/test", "npm:playwright", "pypi:playwright"),
      lib("cypress", "Cypress", "npm:cypress"),
      lib("puppeteer", "Puppeteer", "npm:puppeteer"),
      lib("selenium", "Selenium", "npm:selenium-webdriver", "pypi:selenium"),
    ],
  },
  {
    id: "realtime",
    label: { en: "Realtime transport", vi: "Kết nối realtime" },
    libs: [
      lib("socket.io", "Socket.IO", "npm:socket.io", "npm:socket.io-client", "pypi:python-socketio"),
      lib("ws", "ws", "npm:ws"),
      lib("pusher", "Pusher", "npm:pusher", "npm:pusher-js"),
      lib("ably", "Ably", "npm:ably"),
    ],
  },
  {
    id: "ml",
    label: { en: "ML framework", vi: "Framework machine learning" },
    libs: [
      lib("pytorch", "PyTorch", "pypi:torch"),
      lib("tensorflow", "TensorFlow", "pypi:tensorflow", "npm:@tensorflow/tfjs"),
      lib("jax", "JAX", "pypi:jax"),
    ],
  },
  {
    id: "dataframe",
    label: { en: "Dataframe library", vi: "Thư viện dataframe" },
    soft: true,
    libs: [lib("pandas", "pandas", "pypi:pandas"), lib("polars", "Polars", "pypi:polars")],
  },
];

export interface LibMatch {
  category: Category;
  lib: Lib;
}

const byPackage = new Map<string, LibMatch>();
const byName = new Map<string, LibMatch>();
for (const category of CATEGORIES) {
  for (const l of category.libs) {
    byName.set(l.id.toLowerCase(), { category, lib: l });
    byName.set(l.label.toLowerCase(), { category, lib: l });
    for (const pkg of l.packages) {
      byPackage.set(pkg, { category, lib: l });
      const bare = pkg.slice(pkg.indexOf(":") + 1).toLowerCase();
      if (!byName.has(bare)) byName.set(bare, { category, lib: l });
    }
  }
}

/** Category + library for a dependency key like `npm:axios`. */
export function classifyPackage(key: string): LibMatch | undefined {
  return byPackage.get(key);
}

/** Look up a library by a human name used in decisions: "prisma", "@prisma/client", "Tailwind CSS". */
export function findLib(name: string): LibMatch | undefined {
  return byName.get(name.trim().toLowerCase());
}

/** Does a decision term ("prisma", "@prisma/client", "mongoose") refer to this dependency key? */
export function termMatchesPackage(term: string, key: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return false;
  const bare = key.slice(key.indexOf(":") + 1).toLowerCase();
  if (t === bare || t === key.toLowerCase()) return true;
  const termLib = findLib(t);
  const pkgLib = classifyPackage(key);
  return !!termLib && !!pkgLib && termLib.lib.id === pkgLib.lib.id;
}
