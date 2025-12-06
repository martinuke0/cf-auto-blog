#!/usr/bin/env node

/**
 * Git Workflow Manager
 * Allows running multiple async jobs with interactive commit/push choices
 */

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

class GitWorkflow {
    constructor() {
        this.jobs = [];
        this.currentJob = null;
    }

    async runCommand(command, description) {
        console.log(`\n${description}...`);
        try {
            const result = execSync(command, { stdio: 'inherit', encoding: 'utf8' });
            console.log(`✅ ${description} completed`);
            return true;
        } catch (error) {
            console.error(`❌ ${description} failed:`, error.message);
            return false;
        }
    }

    async createBranch(branchName) {
        return await this.runCommand(
            `git checkout -b ${branchName}`,
            `Creating and switching to branch "${branchName}"`
        );
    }

    async addFiles(exclude = []) {
        const excludeCmd = exclude.length > 0 ? exclude.map(file => `git reset HEAD ${file}`).join(' && ') : '';
        const addCmd = `git add .${excludeCmd ? ` && ${excludeCmd}` : ''}`;
        
        return await this.runCommand(addCmd, 'Adding files to staging');
    }

    async commitFiles(message) {
        return await this.runCommand(
            `git commit -m "${message}"`,
            `Committing changes with message: "${message}"`
        );
    }

    async pushBranch(branchName) {
        return await this.runCommand(
            `git push origin ${branchName}`,
            `Pushing branch "${branchName}" to remote`
        );
    }

    async mergeToMain(sourceBranch) {
        return await this.runCommand(
            `git checkout main && git merge ${sourceBranch}`,
            `Merging ${sourceBranch} into main branch`
        );
    }

    async askYesNo(question) {
        return new Promise((resolve) => {
            rl.question(`${question} (y/n): `, (answer) => {
                const normalized = answer.toLowerCase().trim();
                resolve(normalized === 'y' || normalized === 'yes');
            });
        });
    }

    async executeJob(job) {
        console.log(`\n🚀 Executing job: ${job.name}`);
        console.log(`   Description: ${job.description}`);
        
        let success = true;

        // Create branch if needed
        if (job.createBranch && !await this.branchExists(job.branch)) {
            success = await this.createBranch(job.branch);
            if (!success) return false;
        }

        // Add files
        if (job.addFiles) {
            success = await this.addFiles(job.excludeFiles);
            if (!success) return false;
        }

        // Commit changes
        if (job.commit) {
            const shouldCommit = job.commit === 'prompt' 
                ? await this.askYesNo('Commit these changes?')
                : true;
            
            if (shouldCommit) {
                success = await this.commitFiles(job.commitMessage);
                if (!success) return false;
            }
        }

        // Push changes
        if (job.push) {
            const shouldPush = job.push === 'prompt'
                ? await this.askYesNo('Push these changes to remote?')
                : true;
            
            if (shouldPush) {
                success = await this.pushBranch(job.branch);
                if (!success) return false;
            }
        }

        // Merge to main if specified
        if (job.mergeToMain) {
            const shouldMerge = job.mergeToMain === 'prompt'
                ? await this.askYesNo('Merge to main branch?')
                : true;
            
            if (shouldMerge) {
                success = await this.mergeToMain(job.branch);
                if (!success) return false;
            }
        }

        console.log(`\n✅ Job "${job.name}" completed successfully`);
        return true;
    }

    branchExists(branchName) {
        try {
            execSync(`git rev-parse --verify refs/heads/${branchName}`, { stdio: 'ignore' });
            return true;
        } catch {
            return false;
        }
    }

    async runJobs() {
        console.log('🔧 Git Workflow Manager');
        console.log('========================\n');

        for (let i = 0; i < this.jobs.length; i++) {
            this.currentJob = this.jobs[i];
            
            const shouldRun = await this.askYesNo(
                `Run job ${i + 1}/${this.jobs.length}: ${this.currentJob.name}?`
            );
            
            if (shouldRun) {
                const success = await this.executeJob(this.currentJob);
                if (!success) {
                    const continueAnyway = await this.askYesNo(
                        'Job failed. Continue with remaining jobs?'
                    );
                    if (!continueAnyway) break;
                }
            }
        }

        console.log('\n🎉 All jobs completed!');
        rl.close();
    }
}

// Define workflow jobs
const workflow = new GitWorkflow();

// Add your jobs here
workflow.jobs = [
    {
        name: 'Create cf-auto-blog branch',
        description: 'Create new branch for Cloudflare auto blog fixes',
        createBranch: true,
        branch: 'cf-auto-blog',
        addFiles: true,
        excludeFiles: ['wrangler.toml'],
        commit: 'prompt',
        commitMessage: 'Fix GitHub publishing UTF-8 encoding and add diagnostic tools',
        push: 'prompt'
    },
    {
        name: 'Update documentation',
        description: 'Update README with new troubleshooting information',
        createBranch: false,
        branch: 'cf-auto-blog',
        addFiles: true,
        excludeFiles: [],
        commit: 'prompt',
        commitMessage: 'Update documentation with GitHub troubleshooting guide',
        push: 'prompt'
    },
    {
        name: 'Push cf-auto-blog to main',
        description: 'Merge cf-auto-blog branch into main branch',
        createBranch: false,
        branch: 'main',
        addFiles: false,
        commit: false,
        push: 'prompt',
        mergeToMain: 'prompt'
    },
    {
        name: 'Deploy to production',
        description: 'Deploy changes to Cloudflare Workers',
        createBranch: false,
        branch: 'cf-auto-blog',
        addFiles: false,
        commit: false,
        push: 'prompt'
    }
];

// Check if running in single job mode
const singleJobId = process.argv[2];

if (singleJobId) {
    // Run single job mode
    const job = workflow.jobs.find(j => j.id === singleJobId);
    if (job) {
        console.log(`🚀 Running single job: ${job.name}`);
        const success = await workflow.executeJob(job);
        if (success) {
            console.log('✅ Job completed successfully');
        } else {
            console.log('❌ Job failed');
            process.exit(1);
        }
    } else {
        // Run interactive workflow
        workflow.runJobs().catch(console.error);
    }
}