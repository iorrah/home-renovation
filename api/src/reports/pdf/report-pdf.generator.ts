import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { finished } from 'node:stream/promises';
import PDFDocument from 'pdfkit';
import { DataSource } from 'typeorm';
import { formatCents } from '../../common/money.js';
import { describeDiff } from '../../history/describe-change.js';
import { JobChange } from '../../history/job-change.entity.js';
import { Job } from '../../jobs/job.entity.js';
import { Message } from '../../messages/message.entity.js';
import { User } from '../../users/user.entity.js';

/** Rows read per database round trip, so memory stays flat however long the job's history is. */
const PAGE_SIZE = 500;

const formatDate = (date: Date) => date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

/**
 * Writes the full report for one job: summary, cost and status changes, every history entry,
 * and the whole message log. PDFKit streams pages to disk as they fill up, and rows are read
 * page by page, so a job with 100,000 messages costs about as much memory as one with ten.
 */
@Injectable()
export class ReportPdfGenerator {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async generate(jobId: string, targetPath: string): Promise<void> {
    const manager = this.dataSource.manager;
    // withDeleted: the job may have been soft-deleted after the report was requested.
    const job = await manager.findOneOrFail(Job, {
      where: { id: jobId },
      relations: { contractor: true },
      withDeleted: true,
    });
    const homeowners = await manager
      .createQueryBuilder(User, 'user')
      .innerJoin('job_homeowners', 'member', 'member.user_id = user.id')
      .where('member.job_id = :jobId', { jobId })
      .orderBy('user.username')
      .getMany();

    await mkdir(dirname(targetPath), { recursive: true });
    // Write to a temporary name and rename at the end, so a half-written file is never served.
    const partialPath = `${targetPath}.partial`;
    const doc = new PDFDocument({ size: 'LETTER', margin: 50, bufferPages: false });
    const output = doc.pipe(createWriteStream(partialPath));

    try {
      this.writeSummary(doc, job, homeowners);
      await this.writeHistory(doc, jobId);
      await this.writeMessages(doc, jobId);
      doc.end();
      await finished(output);
      await rename(partialPath, targetPath);
    } catch (error) {
      doc.end();
      await finished(output).catch(() => {});
      await rm(partialPath, { force: true });
      throw error;
    }
  }

  private writeSummary(doc: PDFKit.PDFDocument, job: Job, homeowners: User[]) {
    doc.fontSize(20).text('Renovation Job Report');
    doc
      .moveDown(0.5)
      .fontSize(10)
      .fillColor('#555')
      .text(`Generated ${formatDate(new Date())}`);
    doc.moveDown().fillColor('#000').fontSize(12);
    const rows: [string, string][] = [
      ['Description', job.description],
      ['Address', job.address],
      ['Status', job.status],
      ['Current cost', formatCents(job.costCents)],
      ['Contractor', job.contractor.username],
      ['Homeowners', homeowners.map((h) => h.username).join(', ') || 'None'],
      ['Created', formatDate(job.createdAt)],
    ];
    if (job.deletedAt) rows.push(['Deleted', formatDate(job.deletedAt)]);
    for (const [label, value] of rows) {
      doc
        .font('Helvetica-Bold')
        .text(`${label}: `, { continued: true })
        .font('Helvetica')
        .text(value);
    }
  }

  private async writeHistory(doc: PDFKit.PDFDocument, jobId: string) {
    this.heading(doc, 'Change history');
    let lastChangeNumber = 0;
    for (;;) {
      // Keyset pagination: each page starts after the last row of the previous page.
      const changes = await this.dataSource
        .createQueryBuilder(JobChange, 'change')
        .innerJoinAndSelect('change.responsibleUser', 'user')
        .where('change.jobId = :jobId', { jobId })
        .andWhere('change.changeNumber > :lastChangeNumber', { lastChangeNumber })
        .orderBy('change.changeNumber', 'ASC')
        .limit(PAGE_SIZE)
        .getMany();
      if (changes.length === 0) break;

      for (const change of changes) {
        doc
          .fontSize(10)
          .text(
            `#${change.changeNumber}  ${formatDate(change.createdAt)}  ${change.type}` +
              `  by ${change.responsibleUser.username}` +
              (Object.keys(change.diff).length ? `: ${describeDiff(change.diff)}` : ''),
          );
      }
      lastChangeNumber = changes[changes.length - 1].changeNumber;
    }
    if (lastChangeNumber === 0) doc.fontSize(10).text('No changes recorded.');
  }

  private async writeMessages(doc: PDFKit.PDFDocument, jobId: string) {
    this.heading(doc, 'Messages');
    let last: Message | undefined;
    for (;;) {
      const query = this.dataSource
        .createQueryBuilder(Message, 'message')
        .innerJoinAndSelect('message.author', 'author')
        .where('message.jobId = :jobId', { jobId })
        .orderBy('message.createdAt', 'ASC')
        .addOrderBy('message.id', 'ASC')
        .limit(PAGE_SIZE);
      if (last) {
        // Compare with the stored row, not a JS Date: Postgres keeps microseconds, Date only ms.
        query.andWhere(
          '(message.created_at, message.id) > (SELECT created_at, id FROM messages WHERE id = :lastId)',
          { lastId: last.id },
        );
      }
      const messages = await query.getMany();
      if (messages.length === 0) break;

      for (const message of messages) {
        doc
          .fontSize(9)
          .fillColor('#555')
          .text(`${formatDate(message.createdAt)}  ${message.author.username}`)
          .fillColor('#000')
          .fontSize(10)
          .text(message.body, { indent: 10 })
          .moveDown(0.3);
      }
      last = messages[messages.length - 1];
    }
    if (!last) doc.fontSize(10).text('No messages.');
  }

  private heading(doc: PDFKit.PDFDocument, title: string) {
    doc.addPage().fontSize(16).font('Helvetica-Bold').text(title).font('Helvetica').moveDown(0.5);
  }
}
