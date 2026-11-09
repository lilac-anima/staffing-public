"""Run with python3 tests/review-storage.test.py. Uses only isolated in-memory SQLite."""
import sqlite3, pathlib, unittest, json
class ReviewStorage(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:');self.db.execute('create table tasks(id text primary key,title text)');self.db.execute("insert into tasks values ('keep','Existing task')");self.db.executescript(pathlib.Path('drizzle/0007_worker_reviews.sql').read_text())
 def add(self,id,kind,worker,status,data):
  self.db.execute('insert into worker_reviews values (?,?,?,?,?,?)',(id,kind,worker,status,json.dumps(data),'now'))
 def test_migration_preserves_tasks_and_does_not_fabricate_history(self):
  self.assertEqual(self.db.execute('select count(*) from tasks').fetchone()[0],1);self.assertEqual(self.db.execute('select count(*) from worker_reviews').fetchone()[0],0)
 def test_one_open_review_but_multiple_completed_history_records(self):
  self.add('r1','review','a','Queued',{})
  with self.assertRaises(sqlite3.IntegrityError):self.add('r2','review','a','In review',{})
  self.add('r3','review','a','Completed',{});self.add('r4','review','a','Completed',{})
 def test_concurrent_worker_kind_test_guard(self):
  self.add('t1','test','a','Active',{'workerKind':'Hacker'})
  with self.assertRaises(sqlite3.IntegrityError):self.add('t2','test','b','Active',{'workerKind':' hacker '})
  self.add('t3','test','b','Completed',{'workerKind':'Hacker'})
if __name__=='__main__':unittest.main()
