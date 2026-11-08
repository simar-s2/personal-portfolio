---
title: cluster-scheduler
order: 2
category: Distributed systems
blurb: Job scheduler in Java and gRPC that packs 10K jobs onto 100 nodes and never places a job twice, even across 200 leader failovers.
summary: A cluster scheduler in Java and gRPC. Three control-plane replicas keep all state in PostgreSQL, one of them holds a lease and makes the placement decisions, and fencing tokens stop a replaced leader from committing anything. It packs 10,000 jobs onto 100 Docker nodes at 85% CPU use.
pill: 85% CPU use
repo: https://github.com/simar-s2/cluster-scheduler
stack: [Java, gRPC, PostgreSQL, Docker, Prometheus]
results:
  - label: Jobs placed twice
    value: '0'
    note: Across 200 leader failovers, 100 killed and 100 frozen. Checked against the database history and the workers' own logs.
  - label: CPU use
    value: 85%
    note: Packing 10,000 jobs onto 100 Docker nodes.
  - label: Time to a new leader
    value: 1.8 s
    note: 1,769 ms typical, 2,449 ms slowest. Most of it is waiting for the 2-second lease to expire.
  - label: Recovery from a dead worker
    value: 5 s
    note: Until all of its jobs were running on other workers.
problem:
  - A scheduler needs standby replicas to stay available, but two replicas that both think they lead can place the same job on two machines.
  - Leases alone don't prevent that. A leader that pauses, for a GC stop or a VM migration, can outlive its lease, get replaced, then wake up and finish a write it started before the pause. The write has to be rejected even though every check the old leader made was correct when it made it.
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

Clients and workers can talk to any of the three control planes, which record submissions, registrations and heartbeats in PostgreSQL. That keeps working while there is no leader.

The replica holding the lease row is the leader, and only the leader makes decisions. Every 100 ms it reads pending jobs and free capacity and places each job on the worker with the tightest fit, which keeps large gaps open for large jobs. It commits each decision to PostgreSQL first, then sends it to the worker over gRPC.

Each lease handoff increments an epoch. A leader's writes only commit if its epoch is still current, and workers reject assignments from an epoch older than the newest one they've seen. A replaced leader can't change anything, even before it finds out it was replaced.

A reconcile loop, the same pattern Kubernetes controllers use, runs every second and looks for workers that stopped sending heartbeats and jobs no worker has confirmed. A worker that is silent for 5 seconds is marked dead and its jobs are rescheduled.

## Design decisions

- **Leader election is one row in PostgreSQL.** No etcd or ZooKeeper to run. PostgreSQL is already a single point of failure for the state, so this doesn't add a new one.
- **The lease decides when, the epoch decides whose.** The lease only controls when a new leader may start. Whether a write counts depends on the epoch alone, never on a clock.
- **`SELECT epoch FOR SHARE` in the same transaction as the write.** A separate read would leave a window for a takeover to commit between the check and the write. The share lock makes the takeover wait.
- **Only decisions are fenced.** Placements and dead-worker declarations depend on the leader's view, so they're fenced. Heartbeats, registrations and submissions are recorded by any replica and keep flowing during a failover.
- **`idle_in_transaction_session_timeout = 2s`.** A frozen leader holding the share lock would block the takeover forever. PostgreSQL ends its session after 2 seconds.
- **More than one safeguard.** One decision thread per replica, claims that only match `PENDING` jobs, a unique index on active assignments, fenced transactions, an epoch check on the worker, and deduplication by assignment ID.

## Testing

The tests run the whole system in Docker, with three control planes, PostgreSQL and the workers, and inject failures while jobs are flowing. Integration tests use Testcontainers.

| Leader failover test | Result |
|---|---|
| Leader failovers | 200 (100 killed, 100 frozen) |
| Jobs placed on two workers, from the database history | **0** |
| Jobs that ran on two workers, from the workers' logs | **0** |
| Jobs submitted during the test, and finished | 15,098 of 15,098 |
| Healthy workers wrongly marked dead | 0 |
| Writes from an old leader that the database rejected | 1 |

| Packing test | Result |
|---|---|
| Jobs and workers | 10,000 jobs on 100 workers, in 100 containers |
| CPU use | **85%** |
| Memory use while jobs were waiting | 92.3% average |
| Time to finish every job | 388 s (25.8 jobs per second) |
| One round of scheduling decisions | 5.4 ms average |

The checker that reads the workers' logs has its own tests showing it catches a job running on two workers. A freeze only leads to a rejected write if it lands in the middle of a transaction, which is rare, so a separate integration test covers that case directly.

## Known limits

- PostgreSQL is a single point of failure.
- A worker cut off from the network keeps running its jobs until it reconnects and learns they moved, so for that window a job can run in two places. Having workers stop their own jobs after missing heartbeats would close it.
- Jobs are simulated. They hold their CPU and memory for their duration and do no work.

## Run it

```bash
make cluster-up       # start 3 control planes, PostgreSQL and 5 workers
make jobs             # submit 12 jobs
make cluster-status   # see who leads and how the jobs are packed
make kill-leader      # crash the leader; a standby takes over
make kill-worker      # crash the busiest worker; its jobs move
```
