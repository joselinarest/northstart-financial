import {PGlite} from '@electric-sql/pglite';
import {schemaStatements} from '../db/schema.ts';
import {migrations} from '../db/migrations.ts';
const pg=new PGlite();try{for(const s of schemaStatements)await pg.exec(s);for(const m of migrations){for(const s of m.statements)await pg.exec(s);}console.log('PASS all schema migrations through',migrations.at(-1).id);}catch(e){console.error(e.message,e.query);process.exitCode=1;}finally{await pg.close();}
