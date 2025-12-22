import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoryEntity } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(CategoryEntity)
    private categoryRepository: Repository<CategoryEntity>,
  ) {}

  async createCategory(createCategoryDto: CreateCategoryDto) {
    const existing = await this.categoryRepository.findOne({
      where: { name: createCategoryDto.name },
    });
    if (existing) {
      throw new BadRequestException('Category with this name already exists');
    }

    let parentCategory = null;
    if (createCategoryDto.parentCategoryId) {
      parentCategory = await this.categoryRepository.findOne({
        where: { id: createCategoryDto.parentCategoryId },
      });
      if (!parentCategory) {
        throw new BadRequestException('Parent category not found');
      }
    }

    const category = this.categoryRepository.create({
      name: createCategoryDto.name,
      description: createCategoryDto.description,
      parentCategory: parentCategory || null,
      parentCategoryId: createCategoryDto.parentCategoryId || null,
    });
    return await this.categoryRepository.save(category);
  }

  async findAllCategories() {
    const categories = await this.categoryRepository.find({
      relations: ['children', 'parentCategory'],
      order: { name: 'ASC' },
    });
    
    // Build tree structure - return only root categories with their children
    return categories.filter(cat => !cat.parentCategoryId);
  }

  async findAllCategoriesFlat() {
    return await this.categoryRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findCategoryById(id: number) {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['children', 'items'],
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async updateCategory(id: number, updateCategoryDto: Partial<CreateCategoryDto>) {
    const category = await this.findCategoryById(id);

    if (updateCategoryDto.parentCategoryId) {
      const parentCategory = await this.categoryRepository.findOne({
        where: { id: updateCategoryDto.parentCategoryId },
      });
      if (!parentCategory) {
        throw new BadRequestException('Parent category not found');
      }
      category.parentCategory = parentCategory;
    }

    Object.assign(category, {
      ...updateCategoryDto,
      parentCategoryId: updateCategoryDto.parentCategoryId,
    });
    return await this.categoryRepository.save(category);
  }

  async deleteCategory(id: number) {
    const category = await this.findCategoryById(id);
    await this.categoryRepository.remove(category);
    return { message: 'Category deleted successfully' };
  }

  async bulkImportCategories(data: any[]) {
    const results = { success: 0, failed: 0, errors: [] };
    const categoryMap = new Map<string, CategoryEntity>();

    for (const row of data) {
      try {
        let parentCategory = null;
        if (row.parentCategoryName) {
          if (categoryMap.has(row.parentCategoryName)) {
            parentCategory = categoryMap.get(row.parentCategoryName)!;
          } else {
            parentCategory = await this.categoryRepository.findOne({
              where: { name: row.parentCategoryName },
            });
            if (!parentCategory) {
              throw new Error(`Parent category "${row.parentCategoryName}" not found`);
            }
          }
        }

        const existing = await this.categoryRepository.findOne({
          where: { name: row.name },
        });

        if (!existing) {
          const category = this.categoryRepository.create({
            name: row.name,
            description: row.description || '',
            parentCategory,
            isActive: row.isActive !== false,
          });
          const saved = await this.categoryRepository.save(category);
          categoryMap.set(row.name, saved);
          results.success++;
        }
      } catch (error: any) {
        results.failed++;
        results.errors.push(`Category "${row.name}": ${error.message}`);
      }
    }
    return results;
  }
}
