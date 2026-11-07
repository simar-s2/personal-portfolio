---
title: cluster-scheduler
order: 2
category: Distributed systems
blurb: A Java job scheduler that packs work tightly onto a group of computers and never places a job on two of them, even when its leader crashes.
summary: A job scheduler that packs work tightly onto a group of computers, and never places a job on two of them, even when its leader crashes. Three control planes run at once, all state lives in PostgreSQL, and fencing tokens stop a leader that froze from doing damage when it wakes up.
pill: 97.5% CPU utilization
repo: https://github.com/simar-s2/cluster-scheduler
stack: [Java, gRPC, PostgreSQL, Docker, Prometheus]
results:
  - label: Jobs placed on two workers
    value: '0'
    note: Across 200 leader failures, 100 killed and 100 frozen. Checked in the database's history and in the workers' own logs.
  - label: CPU utilization
    value: 97.5%
    note: Average while jobs were waiting, with 10,000 jobs on 100 workers. The lowest sample was 90.4%.
  - label: Time to a new leader
    value: 1.8 s
    note: 1,769 ms typical and 2,449 ms slowest, bounded by the 2-second lease.
  - label: Recovery from a dead worker
    value: 5.4 s
    note: Typical time until all of its jobs were running on other workers.
problem:
  - A scheduler has two jobs that pull against each other. It has to be available, so it needs several copies and a way to fail over, but it also has to be safe, so a job can never run in two places at once.
  - The hard case is a leader that freezes instead of dying. A long pause can outlast its lease. A standby takes over and moves work around, and then the old leader wakes up still believing it leads and finishes the write it had started. No check of the clock can prevent that, because the check was correct when it happened.
pipeline:
  - name: Submit
    note: any replica saves the job
  - name: Lease
    note: one row in PostgreSQL elects a leader
  - name: Best fit
    note: tightest worker with room
  - name: Fence
    note: commit only if the epoch is current
  - name: Assign
    note: gRPC to the worker, with the epoch
  - name: Reconcile
    note: find dead workers, move their jobs
---

Clients send jobs to any of the three control planes, which save them in PostgreSQL. Workers report in the same way, so jobs and heartbeats keep arriving even while there is no leader.

Whichever control plane holds the lease row is the leader, and only the leader makes decisions. Every 100 ms it reads pending jobs and the free space on each worker, and places each job on the tightest worker that has room, which keeps big gaps free for big jobs. It saves each decision first, then tells the worker over gRPC.

Every time the lease changes hands, a number called the epoch goes up by one. The leader's writes only commit if its epoch is still current, and workers refuse any epoch older than the newest they've seen. So a leader that has been replaced can't change anything, even if it doesn't know yet.

A reconcile loop, the pattern Kubernetes uses, checks every second for workers that have gone quiet and for jobs no worker has confirmed. A worker that misses heartbeats for 5 seconds is declared dead and its jobs go to healthy workers.

## Decisions

- **Leader election is one row in PostgreSQL.** There is no etcd or ZooKeeper to run. PostgreSQL is already a single point of failure for the state, so election adds no new way to fail.
- **Time decides when, the epoch decides whose.** The lease only controls when a new leader may start. Whether a write counts depends on the epoch alone, never on a clock.
- **`SELECT epoch FOR SHARE` in the same transaction as the write.** A plain read would leave a gap where a takeover could commit between the check and the write. The share lock makes a takeover wait, so terms never overlap in the database.
- **Only decisions are fenced.** Placing jobs and declaring workers dead depend on the leader's view. Heartbeats, registrations and submissions are facts, so any replica records them, and they keep flowing during failover.
- **A frozen leader can't block a takeover forever.** `idle_in_transaction_session_timeout = 2s` makes PostgreSQL end its session and release the lock.
- **Several independent layers.** One decision thread per replica, a claim that only works on `PENDING` jobs, a unique index on active assignments, fenced transactions, a worker epoch check, and dedupe by assignment ID. Any one alone would stop most mistakes.

## How I tested it

Each test runs the real system in Docker on my laptop and breaks it on purpose.

| Leader crash test | Result |
|---|---|
| Times the leader was taken down | 200 (100 killed, 100 frozen) |
| Jobs on two workers, from the database's history | **0** |
| Jobs that ran on two workers, from the workers' logs | **0** |
| Jobs submitted during the test, and how many finished | 15,098 and 15,098 |
| Healthy workers wrongly declared dead | 0 |
| Writes from an old leader that the database refused | 1 |

| Packing test | Result |
|---|---|
| Jobs and workers | 10,000 jobs on 100 workers, in 100 containers |
| CPU utilization while jobs were waiting | **97.5%** average, 90.4% lowest |
| Memory utilization while jobs were waiting | 92.3% average |
| Time to finish every job | 388 s (25.8 jobs per second) |
| Time for one round of scheduling decisions | 5.4 ms average |

The check that reads the workers' logs has its own tests showing it catches a job on two workers, so a 0 means something. A freeze only makes the database refuse a write if it lands in the middle of one, which is rare, so a separate integration test covers that case directly.

## Things I learned

- **Killing a process doesn't test fencing.** A killed leader can never send a late write, so killing it only tests that a standby takes over. The test also has to freeze the leader and let it wake up after it has been replaced.
- **Save the logs from a failed run.** The first 100-worker run reported one dead worker in a test that kills nothing, and my script had already deleted the logs. The evidence points to a registration whose reply timed out and was retried. I made registration safe to retry and the next run was clean, but I can't prove that was the cause.
- **A container costs more than the program inside it.** `docker stats` showed each worker was small, yet 100 of them nearly filled Docker's memory. Docker runs its own helper process for each container.

## Known limits

- PostgreSQL is a single point of failure. Nothing can happen without it.
- A worker cut off from the network keeps running its jobs until it reconnects and learns they moved, so for that time a job can be running in two places. Having workers stop their own jobs after missing heartbeats would close that window.
- Tasks are simulated. They hold their CPU and memory for their duration and do no work.

## Run it

```bash
make cluster-up       # start 3 control planes, PostgreSQL and 5 workers
make jobs             # submit 12 jobs
make cluster-status   # see who leads and how the jobs are packed
make kill-leader      # crash the leader; a standby takes over
make kill-worker      # crash the busiest worker; its jobs move
```
