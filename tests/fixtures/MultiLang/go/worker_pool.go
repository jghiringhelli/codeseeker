// Go: Generic worker pool with buffered channels and graceful shutdown
// Paradigm: Concurrency, goroutines, channels, generics (Go 1.21+), WaitGroup
package worker

import (
	"context"
	"sync"
)

// Job represents a unit of work with a typed payload and a result channel.
type Job[T any, R any] struct {
	ID      string
	Payload T
	// Result is optional — callers can pass nil to fire-and-forget.
	Result chan<- Result[R]
}

// Result wraps the output of a worker invocation.
type Result[R any] struct {
	JobID string
	Value R
	Err   error
}

// WorkerPool manages a fixed number of goroutines processing jobs from a shared channel.
type WorkerPool[T any, R any] struct {
	numWorkers int
	jobs       chan Job[T, R]
	wg         sync.WaitGroup
	processor  func(context.Context, T) (R, error)
}

// NewWorkerPool creates a pool with the given number of workers and channel buffer size.
func NewWorkerPool[T any, R any](
	numWorkers int,
	bufferSize int,
	processor func(context.Context, T) (R, error),
) *WorkerPool[T, R] {
	return &WorkerPool[T, R]{
		numWorkers: numWorkers,
		jobs:       make(chan Job[T, R], bufferSize),
		processor:  processor,
	}
}

// Start launches all worker goroutines. Cancel ctx to initiate shutdown.
func (p *WorkerPool[T, R]) Start(ctx context.Context) {
	for i := 0; i < p.numWorkers; i++ {
		p.wg.Add(1)
		go func() {
			defer p.wg.Done()
			for {
				select {
				case job, ok := <-p.jobs:
					if !ok {
						return // channel closed — stop worker
					}
					value, err := p.processor(ctx, job.Payload)
					if job.Result != nil {
						job.Result <- Result[R]{JobID: job.ID, Value: value, Err: err}
					}
				case <-ctx.Done():
					return // context cancelled — stop worker
				}
			}
		}()
	}
}

// Submit enqueues a job. Blocks if the buffer is full.
func (p *WorkerPool[T, R]) Submit(job Job[T, R]) {
	p.jobs <- job
}

// TrySubmit enqueues a job without blocking. Returns false if the buffer is full.
func (p *WorkerPool[T, R]) TrySubmit(job Job[T, R]) bool {
	select {
	case p.jobs <- job:
		return true
	default:
		return false
	}
}

// Stop drains the job channel and waits for all workers to finish.
func (p *WorkerPool[T, R]) Stop() {
	close(p.jobs)
	p.wg.Wait()
}

// WorkerCount returns the configured number of goroutines.
func (p *WorkerPool[T, R]) WorkerCount() int {
	return p.numWorkers
}
