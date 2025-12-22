import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiOkResponse } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@ApiBearerAuth('authorization')
@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({ 
    summary: 'Create Category',
    description: 'Create a new product category'
  })
  @ApiBody({ type: CreateCategoryDto, description: 'Category details' })
  @ApiOkResponse({ description: 'Category created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid category data' })
  async createCategory(@Body() createCategoryDto: CreateCategoryDto) {
    const category = await this.categoriesService.createCategory(createCategoryDto);
    return { statusCode: 201, data: category, message: 'Category created successfully' };
  }

  @Get()
  @ApiOperation({ 
    summary: 'Get All Categories (Hierarchical)',
    description: 'Retrieve all categories in hierarchical structure'
  })
  @ApiOkResponse({ description: 'Categories retrieved successfully' })
  async findAllCategories() {
    const categories = await this.categoriesService.findAllCategories();
    return {
      statusCode: 200,
      data: categories,
      message: 'Categories retrieved successfully',
    };
  }

  @Get('/all')
  @ApiOperation({ 
    summary: 'Get All Categories (Flat)',
    description: 'Retrieve all categories in flat list format'
  })
  @ApiOkResponse({ description: 'Categories retrieved successfully' })
  async findAllCategoriesFlat() {
    const categories = await this.categoriesService.findAllCategoriesFlat();
    return {
      statusCode: 200,
      data: categories,
      totalCount: categories.length,
      message: 'Categories retrieved successfully',
    };
  }

  @Get('/:id')
  @ApiOperation({ 
    summary: 'Get Category Details',
    description: 'Retrieve details of a specific category'
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Category ID' })
  @ApiOkResponse({ description: 'Category retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findCategoryById(@Param('id') id: string) {
    const category = await this.categoriesService.findCategoryById(+id);
    return { statusCode: 200, data: category };
  }

  @Patch('/:id')
  @ApiOperation({ 
    summary: 'Update Category',
    description: 'Update category details'
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Category ID' })
  @ApiBody({ type: CreateCategoryDto, description: 'Updated category details' })
  @ApiOkResponse({ description: 'Category updated successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async updateCategory(
    @Param('id') id: string,
    @Body() updateCategoryDto: Partial<CreateCategoryDto>,
  ) {
    const category = await this.categoriesService.updateCategory(+id, updateCategoryDto);
    return { statusCode: 200, data: category, message: 'Category updated successfully' };
  }

  @Delete('/:id')
  @ApiOperation({ 
    summary: 'Delete Category',
    description: 'Delete a category'
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Category ID' })
  @ApiOkResponse({ description: 'Category deleted successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async deleteCategory(@Param('id') id: string) {
    const result = await this.categoriesService.deleteCategory(+id);
    return { statusCode: 200, data: result };
  }

  @Post('/bulk-import')
  @ApiOperation({ 
    summary: 'Bulk Import Categories',
    description: 'Import multiple categories from CSV/Excel data'
  })
  @ApiBody({ schema: { example: { data: [{ name: 'Electronics', parentId: null }] } } })
  @ApiOkResponse({ description: 'Categories imported successfully' })
  @ApiResponse({ status: 400, description: 'Invalid import data' })
  async bulkImportCategories(@Body() payload: { data: any[] }) {
    const result = await this.categoriesService.bulkImportCategories(payload.data);
    return {
      statusCode: 201,
      data: result,
      message: 'Categories imported successfully',
    };
  }
}
