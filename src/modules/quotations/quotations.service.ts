import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CalculateQuotationDto, SaveQuotationDto } from './dto/quotation.dto';
import { SolarCalculator } from '../../shared';
import { ProjectStage, FollowupStatus } from '@prisma/client';

@Injectable()
export class QuotationsService {
  constructor(private readonly prisma: PrismaService) {}

  calculate(dto: CalculateQuotationDto) {
    return SolarCalculator.calculate({
      panelWattage: dto.panelWattage,
      panelQuantity: dto.panelQuantity,
      meterPhase: dto.meterPhase,
      panelTech: dto.panelTech,
      grossCost: dto.grossCost,
      stateSubsidy: dto.stateSubsidy || 0,
    });
  }

  private async generateNextQuotationNo(): Promise<string> {
    const year = new Date().getFullYear().toString().slice(2);
    const nextYear = (parseInt(year, 10) + 1).toString();
    const count = await this.prisma.quotation.count();
    const indexStr = (count + 1).toString().padStart(2, '0');
    return `TSS/${year}${nextYear}/${indexStr}`;
  }

  async save(dto: SaveQuotationDto, userId: string) {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: dto.inquiryId },
    });
    if (!inquiry) throw new NotFoundException('Inquiry not found.');

    const calc = SolarCalculator.calculate({
      panelWattage: dto.panelWattage,
      panelQuantity: dto.panelQuantity,
      meterPhase: inquiry.meterPhase as any,
      panelTech: dto.panelTech,
      grossCost: dto.grossCost,
      stateSubsidy: dto.stateSubsidy || 0,
    });

    const quotationNo = await this.generateNextQuotationNo();

    return this.prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.upsert({
        where: { inquiryId: dto.inquiryId },
        update: {
          panelBrand: dto.panelBrand,
          panelTech: dto.panelTech,
          panelWattage: dto.panelWattage,
          panelQuantity: dto.panelQuantity,
          plantCapacityKw: calc.plantCapacityKw,
          inverterBrand: dto.inverterBrand,
          inverterCapacityKw: dto.inverterCapacityKw,
          grossCost: dto.grossCost,
          meterCharges: calc.meterCharges,
          centralSubsidy: calc.centralSubsidy,
          stateSubsidy: calc.stateSubsidy,
          netCustomerCost: calc.netCustomerCost,
          annualGenerationKwh: calc.annualGenerationKwh,
          annualSavingsRs: calc.annualSavingsRs,
          paybackPeriodYears: calc.paybackPeriodYears,
          co2ReductionTonnes: calc.co2ReductionTonnes,
          treesSavedAnnually: calc.treesSavedAnnually,
        },
        create: {
          quotationNo,
          inquiryId: dto.inquiryId,
          panelBrand: dto.panelBrand,
          panelTech: dto.panelTech,
          panelWattage: dto.panelWattage,
          panelQuantity: dto.panelQuantity,
          plantCapacityKw: calc.plantCapacityKw,
          inverterBrand: dto.inverterBrand,
          inverterCapacityKw: dto.inverterCapacityKw,
          grossCost: dto.grossCost,
          meterCharges: calc.meterCharges,
          centralSubsidy: calc.centralSubsidy,
          stateSubsidy: calc.stateSubsidy,
          netCustomerCost: calc.netCustomerCost,
          annualGenerationKwh: calc.annualGenerationKwh,
          annualSavingsRs: calc.annualSavingsRs,
          paybackPeriodYears: calc.paybackPeriodYears,
          co2ReductionTonnes: calc.co2ReductionTonnes,
          treesSavedAnnually: calc.treesSavedAnnually,
        },
      });

      await tx.followupLog.create({
        data: {
          inquiryId: dto.inquiryId,
          createdById: userId,
          stage: ProjectStage.QUOTATION_SENT,
          status: FollowupStatus.DONE,
          description: `Quotation ${quotationNo} generated for ${calc.plantCapacityKw} kW at net ₹${calc.netCustomerCost.toLocaleString('en-IN')}.`,
          nextStep: 'Send quotation & follow up',
          committedDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        },
      });

      await tx.inquiry.update({
        where: { id: dto.inquiryId },
        data: { currentStage: ProjectStage.QUOTATION_SENT },
      });

      return quotation;
    });
  }

  async findByInquiry(inquiryId: string) {
    const quote = await this.prisma.quotation.findFirst({
      where: { OR: [{ inquiryId }, { id: inquiryId }, { quotationNo: inquiryId }] },
      include: { inquiry: true },
    });
    if (!quote) throw new NotFoundException('Quotation not found.');
    return quote;
  }
}

